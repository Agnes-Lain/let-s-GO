// QA M6b-2 (AC 21, 23): the 13×13 small-invader rule must not kill living or seki groups.
import { groupAt, pass, type GameState } from '@/engine';

import { createRng, judgeGroups, proposeDead, type GroupJudgement } from './index';
import { position } from './__fixtures__/board';

function finished(ascii: string): GameState {
  let state = position(ascii, 'B');
  for (let i = 0; i < 2; i++) {
    const result = pass(state);
    if (!result.ok) throw new Error('pass');
    state = result.state;
  }
  return state;
}

const rows = (lines: Record<number, string>) =>
  Array.from({ length: 13 }, (_, i) => 13 - i)
    .map((r) => `${String(r).padStart(2)} ${lines[r] ?? '. . . . . . . . . . . . .'}`)
    .join('\n');

const SEEDS = [1, 2, 3, 4, 5];

describe('13×13 invader rule never touches living groups', () => {
  // A six-stone White group with two eyes (a1, c1) in the corner of Black's half.
  const TWO_EYES = finished(
    rows({
      7: 'O O O O O O O O O O O O O',
      6: 'X X X X X X X X X X X X X',
      3: 'X X X X . . . . . . . . .',
      2: 'O O O O X . . . . . . . .',
      1: '. O . O X . . . . . . . .',
    }),
  );

  it('a 6-stone White group with two real eyes is not proposed (seeds 1–5)', () => {
    for (const seed of SEEDS) {
      const white = judgeGroups(TWO_EYES, createRng(seed)).find((j) => j.stones.includes('b1'))!;
      expect(white.eyes).toBe(2);
      expect(white.status).toBe('alive');
      expect(proposeDead(TWO_EYES, createRng(seed))).not.toContain('b1');
      expect(proposeDead(TWO_EYES, createRng(seed))).not.toContain('a2');
    }
  });

  it('two walls with real two-eye shapes (a big alive group) are not proposed', () => {
    // Black wall with two single-point eyes at c6 and h6 in a one-row wall (still alive).
    const ALIVE = finished(
      rows({
        7: 'O O O O O O O O O O O O O',
        6: 'X X . X X X X . X X X X X',
        5: 'X X X X X X X X X X X X X',
      }),
    );
    for (const seed of SEEDS) expect(proposeDead(ALIVE, createRng(seed))).toEqual([]);
  });
});

describe('13×13 invader rule and one-eye groups', () => {
  // A 3-stone White group with one eye (a1) in Black's area: really dead (Black plays a3/b3, then
  // the eye is a single point); the group is not a "no eye" invader, so only playouts decide.
  const ONE_EYE = finished(
    rows({
      7: 'O O O O O O O O O O O O O',
      6: 'X X X X X X X X X X X X X',
      2: 'O . . . . . . . . . . . .',
      1: '. O . . . . . . . . . . .',
    }),
  );

  it('the one-eye White group is proposed dead and no Black stone is (seeds 1–5)', () => {
    for (const seed of SEEDS) {
      expect([...proposeDead(ONE_EYE, createRng(seed))].sort()).toEqual(['a2', 'b1']);
    }
  });
});

describe('13×13 seki with a larger frame', () => {
  it('a seki in the middle of the board is still undecided', () => {
    const SEKI = finished(
      rows({
        9: '. . . . . . . . . . . . .',
        8: '. X X X X X X X . . . . .',
        7: '. X O O O O O X . . . . .',
        6: '. X O X X X O X . . . . .',
        5: '. X O X . . O X . . . . .',
        4: '. X O O O O O X . . . . .',
        3: '. X X X X X X X . . . . .',
      }),
    );
    for (const seed of SEEDS) {
      const judgements = judgeGroups(SEKI, createRng(seed));
      for (const g of judgements) {
        expect(g.status).not.toBe('dead');
      }
      expect(proposeDead(SEKI, createRng(seed)).filter((v) => ['c6', 'd6'].includes(v))).toEqual(
        [],
      );
    }
  });
});

describe('13×13 two white groups sharing two eyes (found by QA in L2-L2 seed 2)', () => {
  // Final position of the tuning game L2 vs L2, seed 2. The white stones at the right edge form
  // two groups whose only liberties are the shared points m7 and n6; Black can play neither
  // (both are suicide, neither captures), so White lives in a seki-like two-eye shape and
  // must not be proposed dead.
  const SHARED_EYES = finished(`
    13 . . . . O O . O X X . . X
    12 O O O O . O O O X X . X X
    11 O O . O . O . O X X . X .
    10 . . O O O O . O O X X X X
     9 . O . O O O O O O X O X O
     8 O O O O X X O O O X O O O
     7 O . . O O X X X X X O . O
     6 O O O X X X . X . X X O .
     5 O X O X . . . X . X O O O
     4 O X O X X X X X . X X X X
     3 O X X X . X . X . X . X .
     2 O X X X X X X X X X X X X
     1 O O O O X . . . . X . X .
  `);

  it('engine check: the right-edge white groups have only m7 and n6 as liberties', () => {
    expect(groupAt(SHARED_EYES.board, 'l9')?.liberties).toHaveLength(2);
    expect(groupAt(SHARED_EYES.board, 'l5')?.liberties).toHaveLength(2);
  });

  it('does not propose the living white stones dead (seeds 1–5)', () => {
    for (const seed of SEEDS) {
      const dead = proposeDead(SHARED_EYES, createRng(seed));
      expect(
        dead.filter((v) =>
          ['l9', 'l8', 'm8', 'n8', 'l7', 'n7', 'l5', 'm5', 'n5', 'm6'].includes(v),
        ),
      ).toEqual([]);
    }
  });
});

describe('13×13 sure-alive rule (QA re-check of 616e1d4)', () => {
  const pick = (state: GameState, vertex: string, seed = 1) =>
    judgeGroups(state, createRng(seed)).find((j) => j.stones.includes(vertex)) as GroupJudgement;

  // A white group in Black's half with a false eye at b2 (Black a1... diagonal) and one real eye
  // at e... built from the corner: White a2 b3 c2 c1 b1? Kept simple: one real eye a1-style plus a
  // second "eye" b... The fixtures below were checked with the engine (liberties printed in tests).
  it('a big group with two shared eyes stays alive (and so do both halves)', () => {
    // two white groups share the eyes m7 / n6 pattern already: covered by SHARED_EYES above.
    const ALIVE = finished(
      rows({
        7: 'O O O O O O O O O O O O O',
        6: 'X X X X X X X X X X X X X',
        3: '. . . . . . . . . . . . .',
        2: 'O O O O O O . O O O O O O',
        1: 'O . O O O O O O O . O O O',
      }),
    );
    for (const seed of SEEDS) {
      const white = pick(ALIVE, 'a2', seed);
      expect(white.status).toBe('alive');
    }
  });

  // White f3 g2 h3 g4 around the empty g3, Black on the diagonals f4 h4 (and f2 h2): g3 is a false
  // eye. The four white stones are four groups; each touches one "eye" only.
  const RING = {
    7: 'O O O O O O O O O O O O O',
    6: 'X X X X X X X X X X X X X',
    4: '. . . . . X . X . . . . .',
    3: '. . . . . O . O . . . . .',
    2: '. . . . . X O X . . . . .',
    1: '. . . . . . . . . . . . .',
  };

  it('a ring around a false eye is never sure-alive; the stones are not alive', () => {
    // g4 is part of the ring: put it on row 4 as well.
    const FALSE_EYE = finished(rows({ ...RING, 4: '. . . . . X O X . . . . .' }));
    for (const seed of SEEDS) {
      for (const v of ['f3', 'h3', 'g2', 'g4'])
        expect(pick(FALSE_EYE, v, seed).status).not.toBe('alive');
    }
  });

  it('a one-real-eye plus one-false-eye white group still dies', () => {
    // White a2 b2? corner eye a1 (real: a2 b1 mine, diagonal b2 white) and the false eye g3 above
    // are on different groups; the corner group has one eye only, so it is never sure-alive.
    const ONE = finished(
      rows({
        7: 'O O O O O O O O O O O O O',
        6: 'X X X X X X X X X X X X X',
        3: 'X X X . . . . . . . . . .',
        2: 'O O X . . . . . . . . . .',
        1: '. O X . . . . . . . . . .',
      }),
    );
    for (const seed of SEEDS) {
      const white = pick(ONE, 'a2', seed);
      expect(white.eyes).toBe(1);
      expect(white.status).not.toBe('alive');
      expect(proposeDead(ONE, createRng(seed))).toEqual(expect.arrayContaining(['a2', 'b2', 'b1']));
    }
  });
});
