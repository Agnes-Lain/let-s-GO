// The Capture Go game reducer (spec docs/specs/M4-bot-capture-go.md §4 B, ACs 17–30).
import { createGame, play, toVertex, type GameState, type Point } from '@/engine';
import type { PlayBotExercise } from '@/lessons';

import {
  BOT_DELAY_MS,
  BOT_DELAY_REDUCED_MS,
  END_BEAT_MS,
  botGameReducer,
  canSkip,
  currentBlunder,
  lossReason,
  outcomeOfGame,
  startBotGame,
  suggest,
  type BotGame,
} from './botGame';

const v = (vertex: string, size = 5): Point => ({
  x: 'abcdefghjklmnopqrst'.indexOf(vertex[0]),
  y: Number(vertex.slice(1)) - 1,
});

function exercise(extra: Partial<PlayBotExercise> = {}): PlayBotExercise {
  return {
    id: 'g',
    type: 'play-bot',
    size: 5,
    setup: { B: ['c3', 'd2'], W: ['d3', 'c2'] },
    win: { kind: 'captureN', n: 1 },
    bot: { level: 1, blunder: 0.5 },
    promptKey: 'p',
    hintKey: 'h',
    explainKey: 'e',
    ...extra,
  };
}

const G1 = exercise({
  setup: { B: ['b3', 'c2', 'd3'], W: ['c3'] },
  bot: { level: 1, blunder: 0.7 },
});

const tap = (g: BotGame, at: string) =>
  botGameReducer(g, { type: 'play', point: v(at, g.game.board.size) });
const bot = (g: BotGame) => botGameReducer(g, { type: 'bot' });

/** The same game with another position (learner to move). */
function at(g: BotGame, state: GameState): BotGame {
  return { ...g, game: state, status: 'your-turn', pending: null, note: null };
}

function stateOf(setup: { B?: string[]; W?: string[] }, toPlay: 'B' | 'W', size: 5 | 7 = 5) {
  return createGame(size, { setup, toPlay });
}

describe('constants (§5.3)', () => {
  it('700 / 300 / 600 ms', () => {
    expect([BOT_DELAY_MS, BOT_DELAY_REDUCED_MS, END_BEAT_MS]).toEqual([700, 300, 600]);
  });
});

describe('start (AC 17)', () => {
  it('learner first: createGame(size, setup, toPlay B), captures 0:0, your turn', () => {
    const g = startBotGame(exercise(), 1);
    expect(g.game).toEqual(createGame(5, { setup: exercise().setup, toPlay: 'B' }));
    expect(g.status).toBe('your-turn');
    expect(g.learner).toBe('B');
    expect(g.pending).toBeNull();
  });

  it('bot first (G5): the bot move is computed at once and the status is bot-thinking', () => {
    const g = startBotGame(exercise({ player: 'W' }), 1);
    expect(g.game.toPlay).toBe('B');
    expect(g.status).toBe('bot-thinking');
    expect(g.pending?.move.color).toBe('B');
    const after = bot(g);
    expect(after.game.moves).toHaveLength(1);
    expect(after.status).toBe('your-turn');
  });

  it('first defaults to B, player to B', () => {
    const g = startBotGame(exercise({ first: 'W' }), 1);
    expect(g.game.toPlay).toBe('W');
    expect(g.status).toBe('bot-thinking');
  });
});

describe('learner moves (AC 18, 19, 23)', () => {
  it('AC 18: a legal move is applied and the turn passes to the bot', () => {
    const g = tap(startBotGame(exercise(), 1), 'a1');
    expect(g.game.moves).toHaveLength(1);
    expect(g.status).toBe('bot-thinking');
    expect(g.pending?.move.color).toBe('W');
    expect(g.last).toMatchObject({ color: 'B', point: v('a1') });
  });

  it('AC 18: taps while the bot is thinking are ignored', () => {
    const g = tap(startBotGame(exercise(), 1), 'a1');
    expect(tap(g, 'a2')).toBe(g);
  });

  it('AC 23: illegal taps change nothing but the note', () => {
    const g = startBotGame(exercise(), 1);
    const occupied = tap(g, 'c3');
    expect(occupied.game).toBe(g.game);
    expect(occupied.status).toBe('your-turn');
    expect(occupied.attempt).toBe(0);
    expect(occupied.note).toEqual({ key: 'game.fb.illegal.occupied' });
  });

  it('AC 19: won as soon as the learner reaches n (no bot move)', () => {
    const g = tap(startBotGame(G1, 1), 'c4');
    expect(g.status).toBe('won');
    expect(g.pending).toBeNull();
  });

  it('AC 19: an overshoot counts (2 stones when 1 more was needed)', () => {
    const g = startBotGame(exercise({ win: { kind: 'captureN', n: 2 } }), 1);
    const state = {
      ...stateOf({ B: ['b4', 'c4', 'e4', 'b3', 'e3', 'c2', 'd2'], W: ['c3', 'd3'] }, 'B'),
      captures: { B: 1, W: 0 },
    };
    const after = tap(at(g, state), 'd4');
    expect(after.game.captures.B).toBe(3);
    expect(after.status).toBe('won');
  });

  it('AC 19: lost when the bot reaches n', () => {
    // Black c3 has one liberty (c4); the bot (blunder 0) captures it.
    const g = startBotGame(exercise({ bot: { level: 1, blunder: 0 } }), 1);
    const state = stateOf({ B: ['c3'], W: ['b3', 'd3', 'c2'] }, 'B');
    const thinking = tap(at(g, state), 'a1');
    const after = bot(thinking);
    expect(after.game.captures.W).toBe(1);
    expect(after.status).toBe('lost');
  });
});

describe('AC 20: game 1', () => {
  it('c4 captures c3: captures.B = 1, won, the bot does not move', () => {
    const g = tap(startBotGame(G1, 3), 'c4');
    expect(g.game.captures.B).toBe(1);
    expect(g.status).toBe('won');
    expect(g.game.moves).toHaveLength(1);
    expect(bot(g)).toBe(g);
    expect(g.note).toEqual({ key: 'game.fb.captured', params: { n: 1 } });
  });

  it('AC 56: a1 instead → the bot answers and the game continues', () => {
    const g = tap(startBotGame(G1, 3), 'a1');
    expect(g.status).toBe('bot-thinking');
    const after = bot(g);
    expect(after.status).toBe('your-turn');
    expect(after.game.moves).toHaveLength(2);
  });
});

describe('end by limit or passes (AC 21, 22)', () => {
  it('AC 21: at maxMoves, more captures wins; equal is a draw', () => {
    const g = startBotGame(exercise({ maxMoves: 2, win: { kind: 'captureN', n: 3 } }), 1);
    const one = tap(g, 'a1');
    const two = bot(one);
    expect(two.game.moves).toHaveLength(2);
    expect(two.status).toBe('draw');
    expect(two.losses).toBe(1); // a draw counts as a loss for the retry
  });

  it('AC 21: maxMoves defaults to 2 × size × size', () => {
    expect(startBotGame(exercise(), 1).maxMoves).toBe(50);
    expect(startBotGame(exercise({ size: 7, setup: {} }), 1).maxMoves).toBe(98);
  });

  // White everywhere except a few single-point eyes: Black has no legal move.
  const eyes = (open: string[]) => {
    const W: string[] = [];
    for (const c of 'abcde')
      for (let r = 1; r <= 5; r++) if (!open.includes(`${c}${r}`)) W.push(`${c}${r}`);
    return stateOf({ W }, 'W');
  };

  it('AC 22: the learner has no legal move → auto-pass with the note; the bot plays on', () => {
    const g = startBotGame(exercise(), 1);
    const state = eyes(['a1', 'c3', 'e5', 'a5']);
    const thinking: BotGame = {
      ...at(g, state),
      status: 'bot-thinking',
      pending: { move: { type: 'pass', color: 'W' }, reason: 'pass' },
    };
    const after = bot(thinking);
    // Bot passed, the learner had no move and passed: two passes end the game.
    expect(after.game.isOver).toBe(true);
    expect(after.status).toBe('draw');

    const thinking2: BotGame = {
      ...thinking,
      pending: { move: { type: 'play', color: 'W', point: v('a5') }, reason: 'random' },
    };
    const after2 = bot(thinking2);
    expect(after2.game.moves.map((m) => m.type)).toEqual(['play', 'pass']);
    expect(after2.note).toEqual({ key: 'game.fb.noMoves' });
    expect(after2.status).toBe('bot-thinking');
    expect(after2.pending?.move.color).toBe('W');
  });

  it('the bot passes when it has no legal move: note botPass, the learner keeps playing', () => {
    // Black everywhere except eyes; the learner is Black, the bot (White) cannot move.
    const B: string[] = [];
    for (const c of 'abcde')
      for (let r = 1; r <= 5; r++) if (!['a1', 'c3', 'e5'].includes(`${c}${r}`)) B.push(`${c}${r}`);
    const g = startBotGame(exercise(), 1);
    const state = stateOf({ B }, 'B');
    const thinking: BotGame = {
      ...at(g, { ...state, toPlay: 'W' }),
      status: 'bot-thinking',
      pending: { move: { type: 'pass', color: 'W' }, reason: 'pass' },
    };
    const after = bot(thinking);
    expect(after.status).toBe('your-turn');
    expect(after.note).toEqual({ key: 'game.fb.botPass' });
  });
});

describe('suicide and ko (AC 24–26)', () => {
  it('AC 24: a "suicide" that captures is legal', () => {
    const g = startBotGame(exercise({ win: { kind: 'captureN', n: 2 } }), 1);
    const after = tap(at(g, stateOf({ B: ['a2'], W: ['b2', 'a1', 'c1'] }, 'B')), 'b1');
    expect(after.game.captures.B).toBe(1);
    expect(after.game.board.cells[0]).toBeNull();
    expect(after.note).toEqual({ key: 'game.fb.captured', params: { n: 1 } });
  });

  it('AC 25: a suicide that captures nothing is rejected', () => {
    const g = startBotGame(exercise(), 1);
    const state = stateOf({ B: ['c3', 'd2'], W: ['a2', 'b1'] }, 'B');
    const after = tap(at(g, state), 'a1');
    expect(after.game).toBe(state);
    expect(after.note).toEqual({ key: 'game.fb.illegal.suicide' });
  });

  it('AC 26: the learner (White) may not retake the ko at once, but may after one exchange', () => {
    const ex = exercise({
      player: 'W',
      bot: { level: 1, blunder: 1 },
      win: { kind: 'captureN', n: 3 },
    });
    let checked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = startBotGame(ex, seed);
      const start = stateOf({ B: ['b4', 'a3', 'b2'], W: ['c4', 'b3', 'd3', 'c2'] }, 'B');
      const r = play(start, 'c3');
      if (!r.ok) throw new Error('c3');
      const ko = at(g, r.state);
      const refused = tap(ko, 'b3');
      expect(refused.note).toEqual({ key: 'game.fb.illegal.ko' });
      expect(refused.game).toBe(ko.game);
      const answered = bot(tap(ko, 'e1'));
      if (answered.status !== 'your-turn' || answered.game.board.cells[2 * 5 + 1] !== null)
        continue;
      const retake = tap(answered, 'b3');
      expect(retake.note).not.toEqual({ key: 'game.fb.illegal.ko' });
      expect(retake.game.moves.length).toBe(answered.game.moves.length + 1);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('outcome, retry, skip (AC 27–29)', () => {
  const lose = (g: BotGame): BotGame => ({
    ...g,
    status: 'lost',
    losses: g.losses + 1,
    pending: null,
  });

  it('AC 27: clean on the first try without hint; solved after a loss or with a hint', () => {
    const won = tap(startBotGame(G1, 1), 'c4');
    expect(outcomeOfGame(won)).toBe('clean');
    const hinted = tap(botGameReducer(startBotGame(G1, 1), { type: 'hint' }), 'c4');
    expect(hinted.hintUsed).toBe(true);
    expect(outcomeOfGame(hinted)).toBe('solved');
    const retried = botGameReducer(lose(startBotGame(G1, 1)), { type: 'retry', seed: 2 });
    expect(outcomeOfGame(tap(retried, 'c4'))).toBe('solved');
    expect(outcomeOfGame(startBotGame(G1, 1))).toBeNull();
  });

  it('AC 28: retry → attempt + 1, blunder min(0.9, base + 0.15 × losses), a new seed', () => {
    let g = startBotGame(exercise({ bot: { level: 1, blunder: 0.4 } }), 1);
    expect(currentBlunder(g)).toBeCloseTo(0.4);
    g = botGameReducer(lose(g), { type: 'retry', seed: 2 });
    expect(g.attempt).toBe(1);
    expect(g.seed).toBe(2);
    expect(g.status).toBe('your-turn');
    expect(g.game.moves).toHaveLength(0);
    expect(currentBlunder(g)).toBeCloseTo(0.55);
    g = botGameReducer(lose(g), { type: 'retry', seed: 3 });
    g = botGameReducer(lose(g), { type: 'retry', seed: 4 });
    expect(currentBlunder(g)).toBeCloseTo(0.85);
    g = botGameReducer(lose(g), { type: 'retry', seed: 5 });
    expect(currentBlunder(g)).toBeCloseTo(0.9);
  });

  it('AC 28: a real loss counts once', () => {
    const g = startBotGame(exercise({ bot: { level: 1, blunder: 0 } }), 1);
    const lost = bot(tap(at(g, stateOf({ B: ['c3'], W: ['b3', 'd3', 'c2'] }, 'B')), 'a1'));
    expect(lost.losses).toBe(1);
    expect(bot(lost)).toBe(lost);
  });

  it('retry is ignored while the game is running', () => {
    const g = startBotGame(exercise(), 1);
    expect(botGameReducer(g, { type: 'retry', seed: 9 })).toBe(g);
  });

  it('AC 29: skip only after 3 losses/draws; it gives revealed', () => {
    let g = startBotGame(exercise(), 1);
    for (let i = 0; i < 2; i++) g = botGameReducer(lose(g), { type: 'retry', seed: i + 2 });
    const third = lose(g);
    expect(canSkip(lose(startBotGame(exercise(), 1)))).toBe(false);
    expect(botGameReducer(lose(startBotGame(exercise(), 1)), { type: 'skip' }).skipped).toBe(false);
    expect(canSkip(third)).toBe(true);
    const skipped = botGameReducer(third, { type: 'skip' });
    expect(skipped.skipped).toBe(true);
    expect(outcomeOfGame(skipped)).toBe('revealed');
  });

  it('restart mid-game: a new game, the first-try credit is gone, no ease', () => {
    const g = tap(startBotGame(G1, 1), 'a1');
    const restarted = botGameReducer(bot(g), { type: 'restart', seed: 7 });
    expect(restarted.game.moves).toHaveLength(0);
    expect(restarted.status).toBe('your-turn');
    expect(restarted.attempt).toBe(1);
    expect(currentBlunder(restarted)).toBeCloseTo(0.7);
    expect(outcomeOfGame(tap(restarted, 'c4'))).toBe('solved');
  });
});

describe('AC 30: lossReason from engine facts', () => {
  it('names the captured group, its last liberty and its size', () => {
    const g = startBotGame(
      exercise({ bot: { level: 1, blunder: 0 }, win: { kind: 'captureN', n: 2 } }),
      1,
    );
    const state = stateOf({ B: ['c3', 'c2'], W: ['b3', 'd3', 'b2', 'd2', 'c1'] }, 'B');
    const lost = bot(tap(at(g, state), 'a5'));
    expect(lost.status).toBe('lost');
    expect(lossReason(lost)).toEqual({ at: 'c2', lib: 'c4', size: 2 });
  });

  it('is null when the game was not lost by a capture', () => {
    expect(lossReason(startBotGame(exercise(), 1))).toBeNull();
  });
});

describe('reading help (§5.4, AC 49, 50)', () => {
  it('after a learner move: capture > own atari > bot atari', () => {
    const g = startBotGame(exercise({ win: { kind: 'captureN', n: 3 } }), 1);
    // Black e3 puts White d3 in atari (d4 left).
    const atari = tap(g, 'e3');
    expect(atari.note).toEqual({ key: 'game.fb.botAtari', params: { at: 'd3' } });
    // Black a1 next to White a2 has the single liberty b1.
    const self = tap(at(g, stateOf({ B: ['e5'], W: ['a2'] }, 'B')), 'a1');
    expect(self.note).toEqual({ key: 'fb.pm.selfAtari' });
  });

  it('after a bot move: own atari note with a stone and its liberty', () => {
    const g = startBotGame(exercise({ win: { kind: 'captureN', n: 3 } }), 1);
    const state = stateOf({ B: ['c3'], W: ['b3', 'd3'] }, 'W');
    const thinking: BotGame = {
      ...at(g, state),
      status: 'bot-thinking',
      pending: { move: { type: 'play', color: 'W', point: v('c2') }, reason: 'atari' },
    };
    const after = bot(thinking);
    expect(after.note).toEqual({ key: 'game.fb.yourAtari', params: { at: 'c3', lib: 'c4' } });
  });

  it('after a bot capture that does not end the game: botCaptured', () => {
    const g = startBotGame(exercise({ win: { kind: 'captureN', n: 3 } }), 1);
    const state = stateOf({ B: ['c3', 'a5'], W: ['b3', 'd3', 'c2'] }, 'W');
    const thinking: BotGame = {
      ...at(g, state),
      status: 'bot-thinking',
      pending: { move: { type: 'play', color: 'W', point: v('c4') }, reason: 'capture' },
    };
    expect(bot(thinking).note).toEqual({ key: 'game.fb.botCaptured', params: { n: 1 } });
  });
});

describe('hint (AC 51, §5.5)', () => {
  it('suggest = the bot rules for the learner with blunder 0', () => {
    expect(suggest(createGame(5, { setup: G1.setup, toPlay: 'B' }))).toMatchObject({
      reason: 'capture',
      at: 'c4',
    });
  });

  it('only on the learner turn; it opens the tip, marks the point and costs clean', () => {
    const g = botGameReducer(startBotGame(G1, 1), { type: 'hint' });
    expect(g.hintOpen).toBe(true);
    expect(g.hint).toMatchObject({ at: 'c4', reason: 'capture' });
    const thinking = tap(startBotGame(G1, 1), 'a1');
    expect(botGameReducer(thinking, { type: 'hint' })).toBe(thinking);
    // The hint closes once the learner has moved.
    expect(tap(g, 'a1').hintOpen).toBe(false);
  });
});

describe('determinism (§6.1)', () => {
  it('the same seed replays the same game', () => {
    const run = (seed: number) => {
      let g = startBotGame(
        exercise({
          size: 7,
          setup: { B: ['d4', 'e3'], W: ['e4', 'd3'] },
          win: { kind: 'captureN', n: 2 },
        }),
        seed,
      );
      const moves: string[] = [];
      for (let i = 0; i < 6 && g.status === 'your-turn'; i++) {
        const s = suggest(g.game);
        if (!s) break;
        g = botGameReducer(g, { type: 'play', point: s.point });
        if (g.status === 'bot-thinking') g = bot(g);
        moves.push(...g.game.moves.map((m) => (m.type === 'play' ? toVertex(m.point, 7) : 'pass')));
      }
      return moves.join(' ');
    };
    expect(run(5)).toBe(run(5));
  });
});
