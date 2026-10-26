// QA M6b-2 (PO decision: sure-alive on every size): 9×9 groups with shared eyes stay alive and a
// real dead group without eyes is still proposed dead.
import { groupAt, pass, type GameState } from '@/engine';

import { createRng, judgeGroups, proposeDead } from './index';
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

const SEEDS = [1, 2, 3, 4, 5];

describe('9×9 sure-alive', () => {
  // Two white groups share the eyes h6 and j5 (neither side can play there: suicide).
  const SHARED = finished(`
    9 X X X X X X X X X
    8 X X X X X X O X O
    7 X X X X X X O O O
    6 X X X X X X O . O
    5 X X X X X X X O .
    4 X X X X X X O O O
    3 X X X X X X X X X
    2 . . . . . . . . .
    1 . . . . . . . . .
  `);

  it('engine check: both white groups have exactly two liberties', () => {
    // g8 group and g4 group, liberties h6 and j5 only.
    expect(groupAt(SHARED.board, 'g8')?.liberties).toHaveLength(2);
    expect(groupAt(SHARED.board, 'h4')?.liberties).toHaveLength(2);
  });

  it('is never proposed dead (seeds 1–5)', () => {
    for (const seed of SEEDS) {
      const dead = proposeDead(SHARED, createRng(seed));
      expect(dead).toEqual([]);
      const white = judgeGroups(SHARED, createRng(seed)).find((j) => j.stones.includes('g8'));
      expect(white?.status).toBe('alive');
    }
  });
});

describe('9×9 real dead group without eyes', () => {
  const DEAD = finished(`
    9 . . . . . . . . .
    8 . . . . . . . . .
    7 . . . . . . . . .
    6 . . . . . . . . .
    5 O O O O O O O O O
    4 X X X X X X X X X
    3 . . . . . . . . .
    2 . . . X . . . . .
    1 . . X O O X . . .
  `);

  it('the two-stone white group in atari (liberty e2, no eye) is still proposed dead (seeds 1–5)', () => {
    for (const seed of SEEDS) {
      expect([...proposeDead(DEAD, createRng(seed))].sort()).toEqual(['d1', 'e1']);
    }
  });
});
