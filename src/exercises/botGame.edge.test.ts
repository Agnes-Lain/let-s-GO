// QA edge cases for Capture Go on the real engine (spec docs/specs/M4-bot-capture-go.md ACs 2, 10, 14, 19, 43, 65).
import { checkMove, createGame, parseBoard, type GameState, type Point } from '@/engine';
import { loadLesson, type PlayBotExercise } from '@/lessons';

import { botGameReducer, startBotGame, type BotGame } from './botGame';

const pt = (vertex: string): Point => ({
  x: 'abcdefghjklmnopqrst'.indexOf(vertex[0]),
  y: Number(vertex.slice(1)) - 1,
});

function ex(extra: Partial<PlayBotExercise> = {}): PlayBotExercise {
  return {
    id: 'g',
    type: 'play-bot',
    size: 5,
    setup: { B: ['c3'], W: ['d3'] },
    win: { kind: 'captureN', n: 1 },
    bot: { level: 1, blunder: 0.5 },
    promptKey: 'p',
    hintKey: 'h',
    explainKey: 'e',
    ...extra,
  };
}

const tap = (g: BotGame, at: string | Point) =>
  botGameReducer(g, { type: 'play', point: typeof at === 'string' ? pt(at) : at });
const bot = (g: BotGame) => botGameReducer(g, { type: 'bot' });
const withState = (g: BotGame, state: GameState): BotGame => ({
  ...g,
  game: state,
  status: 'your-turn',
  pending: null,
  note: null,
});
const asciiState = (rows: string[], toPlay: 'B' | 'W'): GameState => {
  const { board } = parseBoard(rows.join('\n'));
  return { ...createGame(board.size, { toPlay }), board };
};

describe('capture-to-win edge cases (AC 19)', () => {
  it('a three-stone group on the edge counts as 3 captures (n = 3 wins, no bot move)', () => {
    const g = startBotGame(ex({ win: { kind: 'captureN', n: 3 } }), 1);
    const state = asciiState(
      ['. . . . .', '. . . . .', '. . . . .', 'X X X . .', 'O O O . .'],
      'B',
    );
    // parseBoard: first row is the top row. Rows: 5,4,3 empty, 2 = XXX, 1 = OOO; d1 is the last liberty.
    const after = tap(withState(g, state), 'd1');
    expect(after.game.captures.B).toBe(3);
    expect(after.status).toBe('won');
    expect(after.pending).toBeNull();
  });

  it('two separate groups captured by one move count both (n = 2)', () => {
    const g = startBotGame(ex({ win: { kind: 'captureN', n: 2 } }), 1);
    const state = asciiState(
      ['. . . . .', '. X . X .', 'X O . O X', '. X . X .', '. . . . .'],
      'B',
    );
    const after = tap(withState(g, state), 'c3');
    expect(after.game.captures.B).toBe(2);
    expect(after.status).toBe('won');
  });

  it('a corner capture counts one; n = 2 is not won yet', () => {
    const g = startBotGame(ex({ win: { kind: 'captureN', n: 2 } }), 1);
    const state = asciiState(
      ['. . . . .', '. . . . .', '. . . . .', '. . . . .', 'O X . . .'],
      'B',
    );
    const after = tap(withState(g, state), 'a2');
    expect(after.game.captures.B).toBe(1);
    expect(after.status).toBe('bot-thinking');
  });

  it('under Capture Go a suicide that captures nothing is rejected and does not count as an attempt', () => {
    const g = startBotGame(ex(), 1);
    const state = asciiState(
      ['. . . . .', '. . . . .', '. . X . .', 'O . . X .', '. O . . .'],
      'B',
    );
    const after = tap(withState(g, state), 'a1');
    expect(after.note).toEqual({ key: 'game.fb.illegal.suicide' });
    expect(after.game).toBe(state);
    expect(after.status).toBe('your-turn');
  });
});

describe('ko under Capture Go: the bot never retakes at once (AC 14, 26)', () => {
  // 4 . X O .
  // 3 X O . O      Black plays c3 capturing b3: White may not play b3 at once.
  // 2 . X O .
  const ko = ['. . . . .', '. X O . .', 'X O . O .', '. X O . .', '. . . . .'];
  it.each([0, 0.5, 0.9])('blunder %s, seeds 1-40', (blunder) => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = startBotGame(ex({ bot: { level: 1, blunder } }), seed);
      const taken = tap(withState(g, asciiState(ko, 'B')), 'c3');
      expect(taken.game.captures.B).toBe(1);
      expect(taken.status === 'won' || taken.pending !== null).toBe(true);
      const mv = taken.pending?.move;
      if (mv && mv.type === 'play') expect(mv.point).not.toEqual(pt('b3'));
    }
  });
});

describe('G5: the bot plays first as Black (AC 17, 43)', () => {
  const g5 = loadLesson('u06-checkpoint');
  const exercises = (g5.ok ? g5.lesson.exercises : []) as PlayBotExercise[];
  const seven = exercises.find((e) => e.id === 'seven-white')!;

  it('starts with a pending Black move, learner is White, captures count for White', () => {
    expect(seven).toBeDefined();
    const g = startBotGame(seven, 3);
    expect(g.learner).toBe('W');
    expect(g.status).toBe('bot-thinking');
    expect(g.pending?.move.type).toBe('play');
    const afterBot = bot(g);
    expect(afterBot.game.moves.length).toBe(1);
    expect(afterBot.status).toBe('your-turn');
    expect(afterBot.game.toPlay).toBe('W');
    // taps on the bot's turn are ignored
    expect(tap(g, 'a1')).toBe(g);
  });

  it('a White capture increments captures.W and wins at n', () => {
    const g = startBotGame(seven, 3);
    // Black b1 has one liberty (c1); White c1 captures it.
    const state = asciiState(
      [
        '. . . . . . .',
        '. . . . . . .',
        '. . . . . . .',
        '. . . . . . .',
        '. . . . . . .',
        '. O . . . . .',
        'O X . . . . .',
      ],
      'W',
    );
    const lone = withState({ ...g, n: 1 }, state);
    const after = tap(lone, 'c1');
    expect(after.game.captures.W).toBe(1);
    expect(after.status).toBe('won');
  });
});

describe('every Unit 6 game: random learners, bot never illegal, terminates (AC 2, 10, 65)', () => {
  const lessons = ['u06-capture-go', 'u06-checkpoint'].map((id) => loadLesson(id));
  const all = lessons.flatMap((r) => (r.ok ? (r.lesson.exercises as PlayBotExercise[]) : []));

  it('finds the five games', () => expect(all).toHaveLength(5));

  it.each(all.map((e) => [e.id, e] as const))('%s', (_id, exercise) => {
    for (let seed = 1; seed <= 25; seed++) {
      let g = startBotGame(exercise, seed);
      let rnd = seed * 7919;
      const next = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
      let guard = 0;
      while (g.status !== 'won' && g.status !== 'lost' && g.status !== 'draw') {
        expect(guard++).toBeLessThan(400);
        if (g.status === 'bot-thinking') {
          const mv = g.pending!.move;
          if (mv.type === 'play') {
            const pre = g.game;
            const c = checkMove(pre, mv.point);
            expect(c.legal).toBe(true); // never suicide / ko / occupied
          }
          g = bot(g);
        } else {
          const size = exercise.size;
          const legal: Point[] = [];
          for (let x = 0; x < size; x++)
            for (let y = 0; y < size; y++)
              if (checkMove(g.game, { x, y }).legal) legal.push({ x, y });
          if (legal.length === 0)
            throw new Error('your-turn without a legal point and no auto-pass');
          g = tap(g, legal[Math.floor(next() * legal.length)]);
        }
      }
      expect(g.game.moves.length).toBeLessThanOrEqual(g.maxMoves);
    }
  });
});
