// Capture Go 吃子棋 against the bot (spec docs/specs/M4-bot-capture-go.md §4 B, §5.3–5.5, §7.4).
// A pure reducer: the screen holds the timers and calls `bot` after the delay. The bot's reply is
// computed when the learner moves and applied later, so each ply is applied exactly once.
import {
  botRng,
  captureGoStatus,
  chooseMove,
  createRng,
  type BotLevel,
  type BotReason,
} from '@/bot';
import {
  createGame,
  groupAt,
  toVertex,
  type Color,
  type GameState,
  type Group,
  type IllegalReason,
  type Move,
  type MoveFacts,
  type Point,
  type Vertex,
} from '@/engine';
import { capturedCount, type Outcome, type PlayBotExercise } from '@/lessons';

import type { FeedbackLine } from './attempts';
import { applyGameMove, hasLegalPoint } from './engineAdapter';

/** Pause before the bot's stone appears (ms). */
export const BOT_DELAY_MS = 700;
/** The same pause with Reduce Motion on. */
export const BOT_DELAY_REDUCED_MS = 300;
/** After the final capture, before the win / lose card. */
export const END_BEAT_MS = 600;
/** Losses or draws before *Skip this game* is offered. */
export const LOSSES_BEFORE_SKIP = 3;
/** The bot gets this much more careless after each loss or draw … */
export const EASE_PER_LOSS = 0.15;
/** … up to this. */
export const MAX_BLUNDER = 0.9;

export type GameStatus = 'your-turn' | 'bot-thinking' | 'won' | 'lost' | 'draw';

/** The move drawn with the last-move dot and the capture fade. */
export interface LastMove {
  /** Changes with every applied move (the board plays each capture fade once). */
  id: number;
  color: Color;
  /** null for a pass. */
  point: Point | null;
  captured: Point[];
}

export interface Hint {
  point: Point;
  at: Vertex;
  reason: BotReason;
}

export interface BotGame {
  exercise: PlayBotExercise;
  learner: Color;
  bot: Color;
  /** Captures needed to win. */
  n: number;
  maxMoves: number;
  level: BotLevel;
  baseBlunder: number;
  seed: number;
  game: GameState;
  status: GameStatus;
  /** The bot's reply, computed when the learner moved; applied by `bot`. */
  pending: { move: Move; reason: BotReason } | null;
  last: LastMove | null;
  /** Facts of the bot's last stone (for `lossReason`). */
  lastBotFacts: MoveFacts | null;
  /** One reading-help or illegal-move sentence. */
  note: FeedbackLine | null;
  /** Games started in this exercise before this one. */
  attempt: number;
  /** Lost or drawn games in this exercise. */
  losses: number;
  /** Games abandoned with *Restart*. */
  restarts: number;
  hintUsed: boolean;
  hintOpen: boolean;
  hint: Hint | null;
  skipped: boolean;
}

export type BotGameAction =
  | { type: 'play'; point: Point }
  | { type: 'bot' }
  | { type: 'hint' }
  | { type: 'retry'; seed: number }
  | { type: 'restart'; seed: number }
  | { type: 'skip' };

/** The engine's reason for an illegal tap, in plain words (ko and suicide are not named yet). */
function illegalNote(reason: IllegalReason): FeedbackLine {
  switch (reason) {
    case 'suicide':
      return { key: 'game.fb.illegal.suicide' };
    case 'ko':
      return { key: 'game.fb.illegal.ko' };
    default:
      return { key: 'game.fb.illegal.occupied' };
  }
}

function other(color: Color): Color {
  return color === 'B' ? 'W' : 'B';
}

/** The bot's blunder rate for the current game: base + 0.15 per loss, at most 0.9. */
export function currentBlunder(g: BotGame): number {
  const eased = g.baseBlunder + EASE_PER_LOSS * g.losses;
  return Math.round(Math.min(MAX_BLUNDER, Math.max(g.baseBlunder, eased)) * 100) / 100;
}

/** A new game of the exercise (AC 17). `history` carries attempts, losses and the hint. */
export function startBotGame(
  exercise: PlayBotExercise,
  seed: number,
  history: Pick<BotGame, 'attempt' | 'losses' | 'restarts' | 'hintUsed'> = {
    attempt: 0,
    losses: 0,
    restarts: 0,
    hintUsed: false,
  },
): BotGame {
  const learner = exercise.player ?? 'B';
  const game = createGame(exercise.size, {
    setup: exercise.setup,
    toPlay: exercise.first ?? 'B',
  });
  const g: BotGame = {
    exercise,
    learner,
    bot: other(learner),
    n: exercise.win.n,
    maxMoves: exercise.maxMoves ?? 2 * exercise.size * exercise.size,
    level: exercise.bot.level,
    baseBlunder: exercise.bot.blunder ?? 0,
    seed,
    game,
    status: 'your-turn',
    pending: null,
    last: null,
    lastBotFacts: null,
    note: null,
    ...history,
    hintOpen: false,
    hint: null,
    skipped: false,
  };
  return game.toPlay === learner ? learnerTurn(g, null) : botTurn(g);
}

/** The status after a move, with the loss counted once when a game ends badly. */
function settle(g: BotGame): BotGame {
  const result = captureGoStatus(g.game, { n: g.n, player: g.learner, maxMoves: g.maxMoves });
  if (result === 'playing') return g;
  return {
    ...g,
    status: result,
    pending: null,
    hintOpen: false,
    hint: null,
    losses: result === 'won' ? g.losses : g.losses + 1,
  };
}

function isOver(g: BotGame): boolean {
  return g.status === 'won' || g.status === 'lost' || g.status === 'draw';
}

/** The bot's turn: compute its reply now (AC 45). */
function botTurn(g: BotGame): BotGame {
  const choice = chooseMove(g.game, {
    level: g.level,
    blunder: currentBlunder(g),
    rng: botRng(g.seed, g.game.moves.length),
  });
  return { ...g, status: 'bot-thinking', pending: choice };
}

/** The learner's turn; without a legal point they pass automatically (AC 22). */
function learnerTurn(g: BotGame, note: FeedbackLine | null): BotGame {
  if (hasLegalPoint(g.game)) return { ...g, status: 'your-turn', pending: null, note };
  const passed = applyGameMove(g.game, { type: 'pass', color: g.learner });
  if (!passed.ok) return settle({ ...g, note });
  const after = settle({
    ...g,
    game: passed.state,
    last: { id: (g.last?.id ?? 0) + 1, color: g.learner, point: null, captured: [] },
    note: { key: 'game.fb.noMoves' },
  });
  return isOver(after) ? after : botTurn(after);
}

function vertex(g: BotGame, p: Point): Vertex {
  return toVertex(p, g.game.board.size);
}

/** Groups of `color` with exactly one liberty, largest first. */
function groupsInAtari(state: GameState, color: Color): Group[] {
  const { size, cells } = state.board;
  const seen = new Set<number>();
  const found: Group[] = [];
  cells.forEach((cell, i) => {
    if (cell !== color || seen.has(i)) return;
    const group = groupAt(state.board, { x: i % size, y: Math.floor(i / size) });
    if (!group) return;
    for (const s of group.stones) seen.add(s.y * size + s.x);
    if (group.liberties.length === 1) found.push(group);
  });
  return found.sort((a, b) => b.stones.length - a.stones.length);
}

/** §5.4 after the learner's move: capture > own atari > bot atari. */
function learnerNote(g: BotGame, facts: MoveFacts): FeedbackLine | null {
  const n = capturedCount(facts);
  if (n > 0) return { key: 'game.fb.captured', params: { n } };
  if (facts.selfAtari) return { key: 'fb.pm.selfAtari' };
  const [target] = [...facts.opponentAtari].sort((a, b) => b.stones.length - a.stones.length);
  if (target) return { key: 'game.fb.botAtari', params: { at: vertex(g, target.stones[0]) } };
  return null;
}

/** §5.4 after the bot's move: own atari > bot captured > bot passed. */
function botNote(g: BotGame, facts: MoveFacts | null): FeedbackLine | null {
  const [group] = groupsInAtari(g.game, g.learner);
  if (group) {
    return {
      key: 'game.fb.yourAtari',
      params: { at: vertex(g, group.stones[0]), lib: vertex(g, group.liberties[0]) },
    };
  }
  if (facts === null) return { key: 'game.fb.botPass' };
  const n = capturedCount(facts);
  return n > 0 ? { key: 'game.fb.botCaptured', params: { n } } : null;
}

function playLearner(g: BotGame, point: Point): BotGame {
  if (g.status !== 'your-turn') return g;
  const result = applyGameMove(g.game, { type: 'play', color: g.learner, point });
  if (!result.ok) return { ...g, note: illegalNote(result.reason) };
  const facts = result.facts as MoveFacts;
  const moved = settle({
    ...g,
    game: result.state,
    last: { id: (g.last?.id ?? 0) + 1, color: g.learner, point, captured: facts.captured.flat() },
    note: learnerNote(g, facts),
    hintOpen: false,
    hint: null,
  });
  return isOver(moved) ? moved : botTurn(moved);
}

function playBot(g: BotGame): BotGame {
  if (g.status !== 'bot-thinking' || g.pending === null) return g;
  const { move } = g.pending;
  const result = applyGameMove(g.game, move);
  if (!result.ok) throw new Error(`the bot chose an illegal move: ${result.reason}`);
  const moved = settle({
    ...g,
    game: result.state,
    pending: null,
    last: {
      id: (g.last?.id ?? 0) + 1,
      color: g.bot,
      point: move.type === 'play' ? move.point : null,
      captured: result.facts?.captured.flat() ?? [],
    },
    lastBotFacts: result.facts,
    note: null,
  });
  if (isOver(moved)) return moved;
  return learnerTurn(moved, botNote(moved, result.facts));
}

/** The best learner move by the bot's own rules, blunder 0 (§5.5). null without a legal point. */
export function suggest(state: GameState): Hint | null {
  const { move, reason } = chooseMove(state, { level: 1, blunder: 0, rng: createRng(0) });
  if (move.type === 'pass') return null;
  return { point: move.point, at: toVertex(move.point, state.board.size), reason };
}

function nextGame(g: BotGame, seed: number, restarted: boolean): BotGame {
  return startBotGame(g.exercise, seed, {
    attempt: g.attempt + 1,
    losses: g.losses,
    restarts: g.restarts + (restarted ? 1 : 0),
    hintUsed: g.hintUsed,
  });
}

/** The reducer of one play-bot exercise; impossible actions return the same object. */
export function botGameReducer(g: BotGame, action: BotGameAction): BotGame {
  switch (action.type) {
    case 'play':
      return playLearner(g, action.point);
    case 'bot':
      return playBot(g);
    case 'hint':
      if (g.status !== 'your-turn') return g;
      return { ...g, hintUsed: true, hintOpen: true, hint: suggest(g.game), note: null };
    case 'retry':
      return g.status === 'lost' || g.status === 'draw' ? nextGame(g, action.seed, false) : g;
    case 'restart':
      return isOver(g) ? g : nextGame(g, action.seed, true);
    case 'skip':
      return canSkip(g) ? { ...g, skipped: true } : g;
  }
}

/** *Skip this game* is offered after the 3rd loss or draw (AC 29). */
export function canSkip(g: BotGame): boolean {
  return (g.status === 'lost' || g.status === 'draw') && g.losses >= LOSSES_BEFORE_SKIP;
}

/** The exercise outcome once the game is won or skipped (AC 27); null while it is not done. */
export function outcomeOfGame(g: BotGame): Outcome | null {
  if (g.skipped) return 'revealed';
  if (g.status !== 'won') return null;
  return g.losses === 0 && g.restarts === 0 && !g.hintUsed ? 'clean' : 'solved';
}

/**
 * Facts for the lose card (AC 30): the learner's largest group captured by the bot's last move,
 * the liberty the bot filled (= the bot's stone) and the group's size. Never read from the board.
 */
export function lossReason(g: BotGame): { at: Vertex; lib: Vertex; size: number } | null {
  const facts = g.lastBotFacts;
  if (g.status !== 'lost' || !facts || facts.captured.length === 0) return null;
  const [group] = [...facts.captured].sort((a, b) => b.length - a.length);
  return { at: vertex(g, group[0]), lib: vertex(g, facts.point), size: group.length };
}
