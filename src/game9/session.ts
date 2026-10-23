// A whole 9×9 game against the bot (spec docs/specs/M6-bot-levels.md §4.3–4.5, §5): play, pass
// 弃权, Count now, Resign 认输, marking dead stones with the bot, the count and the result. A pure
// reducer: the screen holds the timers and sends `bot` after the delay; it never calls the engine.
import {
  botRng,
  chooseMove,
  deadStonesOf,
  judgeDeadMarks,
  judgeGroups,
  type BotLevel,
  type GroupJudgement,
} from '@/bot';
import { HINTS_PER_GAME, hintFor, hintNote, moveNote, pickNote, type CoachFact } from '@/coach';
import {
  createGame,
  groupAt,
  legalMoves,
  pass,
  play,
  score,
  toVertex,
  type Color,
  type GameState,
  type Move,
  type MoveFacts,
  type Point,
  type ScoreResult,
  type Vertex,
} from '@/engine';

import {
  GAME_KOMI_9,
  L1_BLUNDER_9,
  L1_SKIP_ATARI_9,
  L1_SKIP_SAVE_9,
  L2_SLIP_9,
  TAKEBACKS_PER_GAME,
} from './config';
import { dangerOf, withoutDangerFacts } from './danger';
import { HANDICAP_KOMI, handicapStones, type Handicap } from './handicap';

/** "Count now" needs at least this many moves (AC 23). */
export const COUNT_NOW_MIN_MOVES = 6;
/** Bot pause before its stone appears (AC 16, 41). */
export const BOT_DELAY_MS = 700;
export const BOT_DELAY_REDUCED_MS = 300;

export type Phase = 'playing' | 'mark' | 'count' | 'result';

/** One feedback sentence: an i18n key and its parameters. */
export interface Note {
  key: string;
  params?: Record<string, string | number>;
}

export interface LastMove {
  /** Changes with every applied move (the board plays each capture fade once). */
  id: number;
  color: Color;
  /** null for a pass. */
  point: Point | null;
  captured: Point[];
  /** Brought back by a take-back: shown again, not announced again. */
  restored?: boolean;
}

/** The dead-stone sheet (AC 29): the bot proposes proved-dead groups. */
export interface Dispute {
  points: Vertex[];
}

export interface CountView {
  /** The dead stones removed for this count. */
  dead: Vertex[];
  score: ScoreResult;
  /** "If we had counted now" after a resignation (AC 33): no winner is assigned. */
  hypothetical: boolean;
}

/** The 提示 hint on the board (M6-game-coaching AC 17): a marker (none: nothing urgent) and a reason. */
export interface HintView {
  point: Point | null;
  note: Note;
}

/** Coaching (M6-game-coaching §3): the notes of the last two plies and the hints. */
export interface CoachState {
  /** At most two lines: the learner's move, then the bot's reply (AC 10–12). */
  notes: Note[];
  hint: HintView | null;
  /** null: no limit (Easy, Normal). */
  hintsLeft: number | null;
  /** For the review header (AC 24). */
  hintsUsed: number;
}

export type GameResult =
  | { kind: 'count'; winner: Color | null; margin: number; score: ScoreResult }
  | { kind: 'resigned' };

/** The position before one learner action (M6-beginner-friendly §4.2): what a take-back restores. */
export interface Snapshot {
  game: GameState;
  last: LastMove | null;
  note: Note | null;
}

export interface GameSession {
  level: BotLevel;
  seed: number;
  /** Black stones placed before the game (让子 ràngzǐ, 0 = even game). */
  handicap: Handicap;
  learner: Color;
  bot: Color;
  game: GameState;
  phase: Phase;
  /** The bot is to move (the board is locked, the buttons disabled). */
  thinking: boolean;
  last: LastMove | null;
  note: Note | null;
  /** Mark phase: the learner's dead marks (whole groups). */
  marks: Vertex[];
  /** The bot's opinion on every group, computed once when marking starts. */
  judgements: GroupJudgement[];
  dispute: Dispute | null;
  /** Stones to highlight for a moment (a group the bot showed alive). */
  flash: Vertex[];
  /** How many times the learner chose *Play on* in this game (AC 32). */
  playOnRounds: number;
  count: CountView | null;
  result: GameResult | null;
  coach: CoachState;
  /** One snapshot per learner move or pass since the game (or Play on) started (§4.2). */
  history: Snapshot[];
  /** Take-backs 悔棋 left in this game; null = unlimited (Easy). */
  takebacksLeft: number | null;
}

export type GameEvent =
  | { type: 'play'; point: Point }
  | { type: 'pass' }
  | { type: 'bot' }
  | { type: 'countNow' }
  | { type: 'resign' }
  | { type: 'mark'; at: Vertex }
  | { type: 'clearMarks' }
  | { type: 'markDone' }
  | { type: 'accept' }
  | { type: 'playOn' }
  | { type: 'showCount' }
  | { type: 'countDone' }
  /** Hint 提示 (AC 17). */
  | { type: 'hint' }
  /** The learner touches the board: the next turn starts and the notes clear (AC 12). */
  | { type: 'touch' }
  /** Take back 悔棋 the learner's last move and the bot's reply; `first`: the first time ever. */
  | { type: 'takeback'; first?: boolean }
  /** A new game on the same level; the handicap stays unless given. */
  | { type: 'new'; seed: number; handicap?: Handicap };

/** The empty board, or the handicap stones with White to move (§3). */
function newGame(handicap: Handicap): GameState {
  if (handicap === 0) return createGame(9, { komi: GAME_KOMI_9 });
  return createGame(9, {
    komi: HANDICAP_KOMI,
    setup: { B: handicapStones(handicap) },
    toPlay: 'W',
  });
}

export function startSession(level: BotLevel, seed: number, handicap: Handicap = 0): GameSession {
  return {
    level,
    seed,
    handicap,
    learner: 'B',
    bot: 'W',
    game: newGame(handicap),
    phase: 'playing',
    // With a handicap White moves first: the screen sends `bot` after the delay (AC 2).
    thinking: handicap > 0,
    last: null,
    note: null,
    marks: [],
    judgements: [],
    dispute: null,
    flash: [],
    playOnRounds: 0,
    count: null,
    result: null,
    coach: { notes: [], hint: null, hintsLeft: HINTS_PER_GAME[level], hintsUsed: 0 },
    history: [],
    takebacksLeft: TAKEBACKS_PER_GAME[level],
  };
}

/** The snapshot pushed before a learner action. */
function pushHistory(s: GameSession): Snapshot[] {
  return [...s.history, { game: s.game, last: s.last, note: s.note }];
}

/** The coaching after a ply: notes replaced or extended, the hint marker gone. */
function coachAfter(s: GameSession, notes: Note[]): CoachState {
  return { ...s.coach, notes, hint: null };
}

/** The note line of a played move for the learner (AC 10–14), or none. */
function noteLines(
  s: GameSession,
  before: GameState,
  move: Move,
  after: GameState,
  facts: MoveFacts,
  keep: (facts: CoachFact[]) => CoachFact[] = (f) => f,
): Note[] {
  const note = pickNote(keep(moveNote(before, move, after, facts)), s.learner, move.color);
  return note ? [note] : [];
}

/**
 * The notes after the bot's reply, without the facts the atari line already says (AC 44): the
 * learner's move is re-read from the last snapshot, the bot's from its own move.
 */
function notesAfterReply(s: GameSession, move: Move, after: GameState, facts: MoveFacts): Note[] {
  const danger = dangerOf(after, s.learner);
  const keep = (f: CoachFact[]) => withoutDangerFacts(f, danger, s.learner);
  const mine: Note[] = [];
  const learnerMove = s.game.moves[s.game.moves.length - 1];
  const before = s.history[s.history.length - 1]?.game;
  if (learnerMove?.type === 'play' && learnerMove.color === s.learner && before) {
    const replay = play(before, learnerMove.point);
    if (replay.ok) mine.push(...noteLines(s, before, learnerMove, s.game, replay.facts, keep));
  } else {
    mine.push(...s.coach.notes);
  }
  return [...mine, ...noteLines(s, s.game, move, after, facts, keep)];
}

function apply(state: GameState, move: Move): GameState {
  const result = move.type === 'pass' ? pass(state) : play(state, move.point);
  if (!result.ok) throw new Error(`game9: illegal ${move.type}: ${result.reason}`);
  return result.state;
}

function lastOf(s: GameSession, color: Color, point: Point | null, captured: Point[]): LastMove {
  return { id: (s.last?.id ?? 0) + 1, color, point, captured };
}

/** Starts the dead-stone marking (two passes, AC 20, 25). */
function enterMark(s: GameSession, game: GameState): GameSession {
  return {
    ...s,
    game,
    phase: 'mark',
    thinking: false,
    marks: [],
    judgements: judgeGroups(game, botRng(s.seed, 0x6d61726b + game.moves.length)),
    dispute: null,
    flash: [],
    note: null,
    coach: coachAfter(s, []),
  };
}

function countOf(game: GameState, dead: Vertex[], hypothetical: boolean): CountView {
  return { dead, hypothetical, score: score(game.board, { komi: game.komi, deadStones: dead }) };
}

function enterCount(s: GameSession, dead: Vertex[], note: Note | null): GameSession {
  return {
    ...s,
    phase: 'count',
    dispute: null,
    flash: [],
    note,
    count: countOf(s.game, dead, false),
  };
}

/** The bot's move, or a legal random move if the bot ever throws (§5.3: the bot cannot fail). */
function botMove(s: GameSession): Move {
  const { game, level } = s;
  const rng = botRng(s.seed, game.moves.length);
  try {
    return chooseMove(game, {
      level,
      rng,
      board9: true,
      blunder: level === 1 ? L1_BLUNDER_9 : 0,
      skipSave: level === 1 ? L1_SKIP_SAVE_9 : 0,
      skipAtari: level === 1 ? L1_SKIP_ATARI_9 : 0,
      slip: level === 2 ? L2_SLIP_9 : 0,
    }).move;
  } catch {
    const points = legalMoves(game);
    if (points.length === 0) return { type: 'pass', color: game.toPlay };
    return { type: 'play', color: game.toPlay, point: points[Math.floor(rng() * points.length)] };
  }
}

/** The position before the trailing passes, with the learner to move (AC 31). */
function beforePasses(s: GameSession): GameState {
  const moves = [...s.game.moves];
  while (moves.length > 0 && moves[moves.length - 1].type === 'pass') moves.pop();
  let game = newGame(s.handicap);
  for (const move of moves) game = apply(game, move);
  // The bot passed first: its pass stands, so the learner is to move.
  if (game.toPlay === s.bot) game = apply(game, { type: 'pass', color: s.bot });
  return game;
}

function toggleGroup(s: GameSession, at: Vertex): Vertex[] {
  const group = groupAt(s.game.board, at);
  if (!group) return s.marks;
  const stones = group.stones.map((p) => toVertex(p, 9));
  const marked = s.marks.includes(stones[0]);
  const rest = s.marks.filter((v) => !stones.includes(v));
  return marked ? rest : [...rest, ...stones];
}

function onMarkDone(s: GameSession): GameSession {
  const { disputes } = judgeDeadMarks(s.judgements, s.marks);
  const alive = disputes.filter((d) => d.kind === 'alive');
  if (alive.length > 0) {
    const { group } = alive[0];
    const stones = alive.flatMap((d) => (d.kind === 'alive' ? d.group.stones : []));
    const note: Note =
      group.eyes >= 2
        ? { key: 'game9.dispute.alive', params: { point: group.at } }
        : { key: 'game9.dispute.liberties', params: { point: group.at, count: group.liberties } };
    return { ...s, marks: s.marks.filter((v) => !stones.includes(v)), flash: stones, note };
  }
  const propose = disputes.find((d) => d.kind === 'propose');
  if (propose && propose.kind === 'propose') {
    const points = propose.groups.flatMap((g) => g.stones);
    return {
      ...s,
      dispute: { points },
      flash: [],
      note: {
        key: 'game9.dispute.propose',
        params: { points: propose.groups.map((g) => g.at).join(', ') },
      },
    };
  }
  const unsure = disputes.find((d) => d.kind === 'unsure');
  const note: Note =
    unsure && unsure.kind === 'unsure'
      ? { key: 'game9.dispute.unsure', params: { point: unsure.group.at } }
      : { key: 'game9.mark.agreed' };
  return enterCount(s, s.marks, note);
}

export function gameReducer(s: GameSession, event: GameEvent): GameSession {
  switch (event.type) {
    case 'new':
      return startSession(s.level, event.seed, event.handicap ?? s.handicap);

    case 'takeback': {
      if (!canTakeBack(s)) return s;
      const snap = s.history[s.history.length - 1];
      const id = (s.last?.id ?? 0) + 1;
      return {
        ...s,
        game: snap.game,
        thinking: false,
        // A fresh id and no captures: the board does not replay the old capture fade.
        last: snap.last ? { ...snap.last, id, captured: [], restored: true } : null,
        note: { key: event.first ? 'game9.takeback.first' : 'game9.takeback.done' },
        history: s.history.slice(0, -1),
        takebacksLeft: s.takebacksLeft === null ? null : s.takebacksLeft - 1,
        coach: coachAfter(s, []),
      };
    }

    case 'play': {
      if (s.phase !== 'playing' || s.thinking) return s;
      const result = play(s.game, event.point);
      if (!result.ok) return { ...s, note: { key: `game.fb.illegal.${result.reason}` } };
      const captured = result.facts.captured.flat();
      const move: Move = { type: 'play', color: s.learner, point: event.point };
      return {
        ...s,
        history: pushHistory(s),
        game: result.state,
        thinking: true,
        last: lastOf(s, s.learner, event.point, captured),
        note: null,
        coach: coachAfter(s, noteLines(s, s.game, move, result.state, result.facts)),
      };
    }

    case 'pass': {
      if (s.phase !== 'playing' || s.thinking) return s;
      const game = apply(s.game, { type: 'pass', color: s.learner });
      if (game.isOver) return enterMark(s, game);
      return {
        ...s,
        history: pushHistory(s),
        game,
        thinking: true,
        last: lastOf(s, s.learner, null, []),
        note: { key: 'game9.you.passed' },
        coach: coachAfter(s, []),
      };
    }

    case 'bot': {
      if (s.phase !== 'playing' || !s.thinking) return s;
      const move = botMove(s);
      if (move.type === 'pass') {
        const game = apply(s.game, move);
        if (game.isOver) return enterMark(s, game);
        return {
          ...s,
          game,
          thinking: false,
          last: lastOf(s, s.bot, null, []),
          // The status line says "Bot passed. If you also pass, the game ends." (AC 20).
          note: null,
          coach: coachAfter(s, []),
        };
      }
      const result = play(s.game, move.point);
      if (!result.ok) throw new Error(`game9: bot played an illegal move: ${result.reason}`);
      const captured = result.facts.captured.flat();
      return {
        ...s,
        game: result.state,
        thinking: false,
        last: lastOf(s, s.bot, move.point, captured),
        note: null,
        coach: coachAfter(s, notesAfterReply(s, move, result.state, result.facts)),
      };
    }

    case 'countNow': {
      if (!canCountNow(s)) return s;
      // The learner passes and the bot always agrees (AC 21).
      let game = apply(s.game, { type: 'pass', color: s.learner });
      if (!game.isOver) game = apply(game, { type: 'pass', color: s.bot });
      return enterMark(s, game);
    }

    case 'resign': {
      if (s.phase !== 'playing' || s.thinking) return s;
      return {
        ...s,
        phase: 'result',
        result: { kind: 'resigned' },
        note: null,
        coach: coachAfter(s, []),
      };
    }

    case 'mark': {
      if (s.phase !== 'mark' || s.dispute) return s;
      return { ...s, marks: toggleGroup(s, event.at), flash: [], note: null };
    }

    case 'clearMarks':
      return s.phase === 'mark' && !s.dispute ? { ...s, marks: [], flash: [], note: null } : s;

    case 'markDone':
      return s.phase === 'mark' && !s.dispute ? onMarkDone(s) : s;

    case 'accept': {
      if (s.phase !== 'mark' || !s.dispute) return s;
      const marks = [...new Set([...s.marks, ...s.dispute.points])];
      return enterCount({ ...s, marks }, marks, { key: 'game9.mark.agreed' });
    }

    case 'playOn': {
      if (s.phase !== 'mark') return s;
      const rounds = s.playOnRounds + 1;
      return {
        ...s,
        game: beforePasses(s),
        phase: 'playing',
        thinking: false,
        marks: [],
        judgements: [],
        dispute: null,
        flash: [],
        last: null,
        // No take-back into the finished game; used take-backs stay used (AC 22).
        history: [],
        playOnRounds: rounds,
        coach: coachAfter(s, []),
        note:
          rounds >= 2
            ? { key: 'game9.dispute.captureHint' }
            : { key: 'game9.dispute.playOn.status' },
      };
    }

    case 'showCount': {
      if (s.phase !== 'result' || s.result?.kind !== 'resigned') return s;
      const judgements = judgeGroups(s.game, botRng(s.seed, 0x72657369 + s.game.moves.length));
      return { ...s, phase: 'count', count: countOf(s.game, deadStonesOf(judgements), true) };
    }

    case 'hint': {
      if (s.phase !== 'playing' || s.thinking || s.coach.hint || s.coach.hintsLeft === 0) return s;
      const hint = hintFor(s.game);
      // "Nothing urgent" costs no hint (AC 22).
      const used = hint.point ? 1 : 0;
      return {
        ...s,
        coach: {
          notes: [],
          hint: { point: hint.point, note: hintNote(hint) },
          hintsLeft: s.coach.hintsLeft === null ? null : s.coach.hintsLeft - used,
          hintsUsed: s.coach.hintsUsed + used,
        },
      };
    }

    case 'touch': {
      if (s.phase !== 'playing' || s.thinking || s.coach.notes.length === 0) return s;
      return { ...s, coach: { ...s.coach, notes: [] } };
    }

    case 'countDone': {
      if (s.phase !== 'count' || !s.count) return s;
      if (s.count.hypothetical) return { ...s, phase: 'result' };
      const counted = s.count.score;
      return {
        ...s,
        phase: 'result',
        result: { kind: 'count', winner: counted.winner, margin: counted.margin, score: counted },
      };
    }
  }
}

/** Take back 悔棋 is possible (AC 19, 20). */
export function canTakeBack(s: GameSession): boolean {
  return s.phase === 'playing' && !s.thinking && s.history.length > 0 && s.takebacksLeft !== 0;
}

/** *Count now* is offered (AC 21, 23). */
export function canCountNow(s: GameSession): boolean {
  return s.phase === 'playing' && !s.thinking && s.game.moves.length >= COUNT_NOW_MIN_MOVES;
}

/** Some group of either colour is in atari (the extra line of the Count now sheet, AC 21). */
export function anyAtari(game: GameState): boolean {
  const seen = new Set<number>();
  const { cells } = game.board;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === null || seen.has(i)) continue;
    const group = groupAt(game.board, { x: i % 9, y: Math.floor(i / 9) });
    if (!group) continue;
    for (const p of group.stones) seen.add(p.y * 9 + p.x);
    if (group.liberties.length === 1) return true;
  }
  return false;
}

export type GameOutcome = 'win' | 'loss' | 'resigned';

/** The learner's outcome once the game has a result. */
export function outcomeOf(s: GameSession): GameOutcome | null {
  if (!s.result) return null;
  if (s.result.kind === 'resigned') return 'resigned';
  return s.result.winner === s.learner ? 'win' : 'loss';
}

/**
 * One engine fact for a lost count (§7 "Loss reason"): komi decided it, else stones the bot
 * captured (when it captured more), else the bigger area.
 */
export function lossFact(s: GameSession): Note | null {
  if (s.result?.kind !== 'count' || s.result.winner === s.learner) return null;
  const { black, white } = s.result.score;
  const lead = black.total - (white.total - white.komi);
  if (lead > 0) return { key: 'game9.result.fact.komi', params: { margin: lead } };
  const lost = s.game.captures[s.bot];
  if (lost > 0 && lost > s.game.captures[s.learner]) {
    return { key: 'game9.result.fact.captured', params: { count: lost } };
  }
  return { key: 'game9.result.fact.land', params: { white: white.total, black: black.total } };
}

/** The status line above the board (§5.3). */
export function statusOf(s: GameSession): Note {
  switch (s.phase) {
    case 'playing': {
      if (s.thinking) return { key: 'game9.turn.bot' };
      const last = s.game.moves[s.game.moves.length - 1];
      if (last?.type === 'pass' && last.color === s.bot) return { key: 'game9.bot.passed' };
      return { key: 'game9.turn.you' };
    }
    case 'mark':
      return { key: 'game9.mark.prompt' };
    case 'count':
      return s.count ? winnerNote(s.count.score.winner, s.count.score.margin) : winnerNote(null, 0);
    case 'result':
      if (s.result?.kind === 'resigned') return { key: 'game9.result.resigned' };
      if (outcomeOf(s) === 'win') return { key: 'game9.result.win' };
      return { key: 'game9.result.lose' };
  }
}

/** "Black wins by 3.5" / "White wins by 1.5" (AC 30); "Draw" only with an integer komi. */
export function winnerNote(winner: Color | null, margin: number): Note {
  if (winner === 'B') return { key: 'game9.result.blackWins', params: { margin } };
  if (winner === 'W') return { key: 'game9.result.whiteWins', params: { margin } };
  return { key: 'game9.result.draw' };
}
