// Spec docs/specs/M6b-13x13-bot-tuning.md §4.5, AC 16–21, 23: the dead-stone proposal on 13×13
// (columns a–n without i, row 13 on top). Each fixture is also checked with the engine: every
// stone has a liberty and the group facts match the spec's hand check (§10).
import { groupAt, pass, type GameState } from '@/engine';

import { createRng, judgeGroups, proposeDead, type GroupJudgement } from './index';
import { position } from './__fixtures__/board';

/** A finished game: the position after two passes. */
function finished(ascii: string): GameState {
  let state = position(ascii, 'B');
  for (let i = 0; i < 2; i++) {
    const result = pass(state);
    if (!result.ok) throw new Error('pass');
    state = result.state;
  }
  return state;
}

const EMPTY_ROW = '. . . . . . . . . . . . .';

/** Rows 13…1 of base position **W**, with `edits` ("g3": 'O') applied. */
function wallsWith(edits: Record<string, 'X' | 'O'> = {}): GameState {
  const columns = 'abcdefghjklmn';
  const rows: string[] = [];
  for (let row = 13; row >= 1; row--) {
    const cells = (row === 7 ? 'O '.repeat(13) : row === 6 ? 'X '.repeat(13) : `${EMPTY_ROW} `)
      .trim()
      .split(' ');
    for (const [vertex, stone] of Object.entries(edits)) {
      if (Number(vertex.slice(1)) === row) cells[columns.indexOf(vertex[0])] = stone;
    }
    rows.push(`${String(row).padStart(2)} ${cells.join(' ')}`);
  }
  return finished(rows.join('\n'));
}

/** AC 16 names seeds 1–20; the other fixtures use seeds 1–5 to keep `npm test` fast. */
const SEEDS_20 = Array.from({ length: 20 }, (_, i) => i + 1);
const SEEDS = SEEDS_20.slice(0, 5);

/** The engine's liberties of the group on `vertex`. */
function libertiesAt(state: GameState, vertex: string): number {
  const group = groupAt(state.board, vertex);
  if (!group) throw new Error(`no stone on ${vertex}`);
  return group.liberties.length;
}

/** Every stone of the position has at least one liberty (nothing is capturable as it stands). */
function everyStoneHasLiberty(state: GameState): boolean {
  const { size, cells } = state.board;
  return cells.every(
    (stone, i) =>
      stone === null ||
      (groupAt(state.board, { x: i % size, y: Math.floor(i / size) })?.liberties.length ?? 0) > 0,
  );
}

const W = wallsWith();

describe('base position W (two walls)', () => {
  it('engine check: each wall is one 13-stone group with 13 liberties', () => {
    expect(everyStoneHasLiberty(W)).toBe(true);
    expect(groupAt(W.board, 'a6')?.stones).toHaveLength(13);
    expect(groupAt(W.board, 'a7')?.stones).toHaveLength(13);
    expect(libertiesAt(W, 'a6')).toBe(13);
    expect(libertiesAt(W, 'a7')).toBe(13);
  });

  it('AC 16: nothing is proposed dead (seeds 1–20)', () => {
    for (const seed of SEEDS_20) expect(proposeDead(W, createRng(seed))).toEqual([]);
  });
});

describe('AC 17: one lone invader in each big territory', () => {
  const position = wallsWith({ g3: 'O', g11: 'X' });

  it('engine check: each invader has 4 liberties', () => {
    expect(everyStoneHasLiberty(position)).toBe(true);
    expect(libertiesAt(position, 'g3')).toBe(4);
    expect(libertiesAt(position, 'g11')).toBe(4);
  });

  it('proposes exactly {g3, g11} (seeds 1–5)', () => {
    for (const seed of SEEDS) {
      expect([...proposeDead(position, createRng(seed))].sort()).toEqual(['g11', 'g3']);
    }
  });
});

describe('AC 18: a White stone in atari on the edge', () => {
  const position = wallsWith({ a3: 'O', a2: 'X', a4: 'X' });

  it('engine check: a3 has one liberty (b3); a2 and a4 have two each', () => {
    expect(everyStoneHasLiberty(position)).toBe(true);
    expect(groupAt(position.board, 'a3')?.liberties).toEqual([{ x: 1, y: 2 }]);
    expect(libertiesAt(position, 'a2')).toBe(2);
    expect(libertiesAt(position, 'a4')).toBe(2);
  });

  it('proposes exactly {a3} (seeds 1–5)', () => {
    for (const seed of SEEDS) expect(proposeDead(position, createRng(seed))).toEqual(['a3']);
  });
});

describe('AC 19: a two-stone White pair inside Black’s area', () => {
  const position = wallsWith({ g3: 'O', h3: 'O' });

  it('engine check: g3–h3 is one group with 6 liberties', () => {
    expect(everyStoneHasLiberty(position)).toBe(true);
    expect(groupAt(position.board, 'g3')?.stones).toHaveLength(2);
    expect(libertiesAt(position, 'g3')).toBe(6);
  });

  it('proposes exactly {g3, h3} (seeds 1–5)', () => {
    for (const seed of SEEDS) {
      expect([...proposeDead(position, createRng(seed))].sort()).toEqual(['g3', 'h3']);
    }
  });
});

describe('AC 20–21: corner position E (Black alive with two eyes)', () => {
  const E = finished(`
    13 . . . . . . . . . . . . .
    12 . . . . . . . . . . . . .
    11 . . . . . . . . . . . . .
    10 . . . . . . . . . . . . .
     9 . . . . . . . . . . . . .
     8 . . . . . . . . . . . . .
     7 . . . . . . . . . . . . .
     6 . . . . . . . . . . . . .
     5 . . . . . . . . . . . . .
     4 . . . . . . . . . . . . .
     3 O O O O . . . . . . . . .
     2 X X X X O . . . . . . . .
     1 . X . X O . . . . . . . .
  `);

  it('engine check: Black is one group whose liberties are the eyes a1 and c1', () => {
    expect(everyStoneHasLiberty(E)).toBe(true);
    const black = groupAt(E.board, 'a2');
    expect(black?.stones).toHaveLength(6);
    expect(black?.liberties).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(libertiesAt(E, 'a3')).toBe(5);
    expect(libertiesAt(E, 'e1')).toBe(3);
    expect(groupAt(E.board, 'e1')?.stones).toHaveLength(2);
  });

  it('no Black stone is proposed dead and the Black group is alive (seeds 1–5)', () => {
    for (const seed of SEEDS) {
      const black = judgeGroups(E, createRng(seed)).find((j) => j.color === 'B') as GroupJudgement;
      expect(black.eyes).toBe(2);
      expect(black.status).toBe('alive');
      expect(proposeDead(E, createRng(seed)).filter((v) => black.stones.includes(v))).toEqual([]);
    }
  });
});

describe('AC 23: a 13×13 seki stays undecided', () => {
  // Seki (双活): the 9×9 fixture of deadStones.test.ts in the lower-left corner of a 13×13 board.
  // The small-invader rule must not fire: the inner Black group is small, but the White ring
  // around it is undecided by playouts, so its area is not enclosed by living stones.
  const SEKI = finished(`
    13 . . . . . . . . . . . . .
    12 . . . . . . . . . . . . .
    11 . . . . . . . . . . . . .
    10 . . . . . . . . . . . . .
     9 . . . . . . . . . . . . .
     8 . . . . . . . . . . . . .
     7 X X X X X X X X . . . . .
     6 X O O O O O O X . . . . .
     5 X O X X X X O X . . . . .
     4 X O . . O O O X . . . . .
     3 X O O O O O O X . . . . .
     2 X X X X X X X X . . . . .
     1 . . . . . . . . . . . . .
  `);

  it('engine check: the inner Black group and the White ring share the liberties c4 and d4', () => {
    expect(everyStoneHasLiberty(SEKI)).toBe(true);
    expect(libertiesAt(SEKI, 'c5')).toBe(2);
    expect(libertiesAt(SEKI, 'b5')).toBe(2);
  });

  it('neither seki group is proposed dead (seeds 1–5)', () => {
    for (const seed of SEEDS) {
      const judgements = judgeGroups(SEKI, createRng(seed));
      for (const v of ['c5', 'b5']) {
        const group = judgements.find((j) => j.stones.includes(v)) as GroupJudgement;
        expect(group.status).toBe('undecided');
      }
    }
  });
});
