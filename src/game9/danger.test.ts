// Spec docs/specs/M6-beginner-friendly.md §4.3 (AC 26–29, 33) and §4.6 (AC 44): groups in atari
// 叫吃 jiàochī from the engine's liberties, the one feedback line, and the coaching dedupe.
import { moveNote, type CoachFact } from '@/coach';
import { createGame, parseVertex, play, toVertex, type GameState, type Point } from '@/engine';

import { position } from '@/bot/__fixtures__/board';

import { atariLine, dangerOf, withoutDangerFacts } from './danger';

const v = (points: readonly Point[]) => points.map((p) => toVertex(p, 9));

// §5.3 diagram A: Black D4 surrounded by White C4 E4 D5, liberty D3.
const A = position(
  `
  9 . . . . . . . . .
  8 . . . . . . . . .
  7 . . . . . . . . .
  6 . . . . . . . . .
  5 . . . O . . . . .
  4 . . O X O . . . .
  3 . . . . . . . . .
  2 . . . . . . . . .
  1 . . . . . . . . .
  `,
  'B',
);

// §5.3 diagram B: White G7 surrounded by Black F7 G8 H7, liberty G6.
const B = position(
  `
  9 . . . . . . . . .
  8 . . . . . . X . .
  7 . . . . . X O X .
  6 . . . . . . . . .
  5 . . . . . . . . .
  4 . . . . . . . . .
  3 . . . . . . . . .
  2 . . . . . . . . .
  1 . . . . . . . . .
  `,
  'B',
);

describe('dangerOf (AC 26–28)', () => {
  it('an empty board and a board without atari have no danger', () => {
    expect(dangerOf(createGame(9))).toEqual([]);
    const quiet = position(
      `
      . . . . .
      . X O . .
      . . . . .
      . . . . .
      . . . . .
      `,
      'B',
    );
    expect(dangerOf(quiet)).toEqual([]);
  });

  it('AC 27: diagram A → exactly {B, [d4], liberty d3}', () => {
    const groups = dangerOf(A);
    expect(groups).toHaveLength(1);
    expect(groups[0].color).toBe('B');
    expect(v(groups[0].stones)).toEqual(['d4']);
    expect(toVertex(groups[0].liberty, 9)).toBe('d3');
  });

  it('AC 28: diagram B → exactly {W, [g7], liberty g6}', () => {
    const groups = dangerOf(B);
    expect(groups).toHaveLength(1);
    expect(groups[0].color).toBe('W');
    expect(v(groups[0].stones)).toEqual(['g7']);
    expect(toVertex(groups[0].liberty, 9)).toBe('g6');
  });

  const list = (game: GameState) =>
    dangerOf(game).map((g) => `${g.color}:${v(g.stones).join('+')}@${toVertex(g.liberty, 9)}`);

  it('AC 29: a 3-stone Black group comes before a lone Black stone in a lower column', () => {
    const game = position(
      `
      9 X O . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . O O O
      2 . . . . . O X X X
      1 . . . . . . O O .
      `,
      'B',
    );
    expect(list(game)).toEqual(['B:g2+h2+j2@j1', 'B:a9@a8']);
  });

  it('AC 29: a Black stone comes before a bigger White group', () => {
    const game = position(
      `
      9 X O . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . X X . . .
      2 . . . X O O . . .
      1 . . . . X X . . .
      `,
      'B',
    );
    expect(list(game)).toEqual(['B:a9@a8', 'W:e2+f2@g2']);
  });

  it('AC 26: same size and colour → lower first-stone column first', () => {
    const game = position(
      `
      9 X O . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . O X
      `,
      'B',
    );
    expect(list(game)).toEqual(['B:a9@a8', 'B:j1@j2']);
  });
});

describe('atariLine (AC 33)', () => {
  it('own, one stone: key you.one with uppercase points', () => {
    expect(atariLine(dangerOf(A), 'B')).toEqual({
      note: { key: 'game9.atari.you.one', params: { where: 'D4', lib: 'D3' } },
      more: 0,
    });
  });

  it('White, one stone: key bot.one', () => {
    expect(atariLine(dangerOf(B), 'B')).toEqual({
      note: { key: 'game9.atari.bot.one', params: { where: 'G7', lib: 'G6' } },
      more: 0,
    });
  });

  it('several stones: at most 3 listed, then "…"; more groups counted', () => {
    const stones = (n: number): Point[] => Array.from({ length: n }, (_, i) => ({ x: i, y: 4 }));
    const groups = [
      { color: 'B' as const, stones: stones(2), liberty: { x: 0, y: 3 } },
      { color: 'W' as const, stones: stones(1), liberty: { x: 8, y: 8 } },
      { color: 'W' as const, stones: stones(1), liberty: { x: 7, y: 8 } },
    ];
    expect(atariLine(groups, 'B')).toEqual({
      note: { key: 'game9.atari.you.many', params: { where: 'A5, B5', lib: 'A4' } },
      more: 2,
    });
    const big = [{ color: 'W' as const, stones: stones(4), liberty: { x: 4, y: 3 } }];
    expect(atariLine(big, 'B')?.note).toEqual({
      key: 'game9.atari.bot.many',
      params: { where: 'A5, B5, C5, …', lib: 'E4' },
    });
  });

  it('nothing in atari → null', () => expect(atariLine([], 'B')).toBeNull());
});

describe('AC 44: coach facts about a group in atari are dropped', () => {
  // Diagram A before White's D5: White plays D5 and puts D4 in atari.
  const before: GameState = position(
    `
    9 . . . . . . . . .
    8 . . . . . . . . .
    7 . . . . . . . . .
    6 . . . . . . . . .
    5 . . . . . . . . .
    4 . . O X O . . . .
    3 . . . . . . . . .
    2 . . . . . . . . .
    1 . . . . . . . . .
    `,
    'W',
  );

  it("the bot's atari and the learner's exposed fact about D4 are dropped", () => {
    const result = play(before, 'd5');
    if (!result.ok) throw new Error('d5');
    const move = { type: 'play' as const, color: 'W' as const, point: parseVertex('d5', 9) };
    const facts = moveNote(before, move, result.state, result.facts);
    expect(facts.map((f) => f.kind).sort()).toEqual(['atari', 'exposed']);
    expect(withoutDangerFacts(facts, dangerOf(result.state), 'B')).toEqual([]);
  });

  it('facts about other groups and of other kinds stay', () => {
    const danger = dangerOf(A);
    const at = (s: string) => parseVertex(s, 9);
    const facts: CoachFact[] = [
      { kind: 'capture', color: 'W', point: at('d4'), count: 1 },
      { kind: 'escape', color: 'B', point: at('j8'), size: 1 },
      { kind: 'exposed', color: 'B', point: at('j9'), size: 1 },
      { kind: 'atari', color: 'B', point: at('d5'), size: 1 },
      { kind: 'selfAtari', color: 'B', point: at('d3'), size: 2 },
      { kind: 'selfAtari', color: 'B', point: at('d4'), size: 1 },
    ];
    expect(withoutDangerFacts(facts, danger, 'B').map((f) => f.kind)).toEqual([
      'capture',
      'escape',
      'exposed',
      'atari',
    ]);
  });

  it('QA: "escaped the atari" about a group still in atari is dropped (it contradicts the line)', () => {
    const facts: CoachFact[] = [
      { kind: 'escape', color: 'B', point: parseVertex('d4', 9), size: 1 },
      { kind: 'escape', color: 'W', point: parseVertex('d4', 9), size: 1 },
    ];
    expect(withoutDangerFacts(facts, dangerOf(A), 'B')).toEqual([facts[1]]);
  });

  it('White groups in atari never drop facts', () => {
    const facts: CoachFact[] = [
      { kind: 'atari', color: 'B', point: parseVertex('g7', 9), size: 1 },
    ];
    expect(withoutDangerFacts(facts, dangerOf(B), 'B')).toEqual(facts);
  });
});
