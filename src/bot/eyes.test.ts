// Spec docs/specs/M6-bot-levels.md §6 and §10: single-point eyes (眼) and false eyes.
import { parseBoard, parseVertex } from '@/engine';

import { isOwnEye } from './eyes';

const eye = (ascii: string, at: string, color: 'B' | 'W' = 'W') => {
  const { board } = parseBoard(ascii);
  return isOwnEye(board, parseVertex(at, 9), color);
};

describe('isOwnEye (§6, §10)', () => {
  it('§10 diagram 1: b2 is a real eye (centre rule, 3 of 4 diagonals own)', () => {
    const ascii = `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 O O . . . . . . .
      2 O . O . . . . . .
      1 O O O . . . . . .
    `;
    expect(eye(ascii, 'b2')).toBe(true);
    expect(eye(ascii, 'c3')).toBe(false);
    expect(eye(ascii, 'b2', 'B')).toBe(false);
  });

  it('§10 diagram 2: b1 is an edge eye when a2 and c2 are own; c2 empty makes it false', () => {
    const real = `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 O O O . . . . . .
      1 O . O . . . . . .
    `;
    expect(eye(real, 'b1')).toBe(true);
    const noC2 = `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 O O . . . . . . .
      1 O . O . . . . . .
    `;
    // Edge rule: both on-board diagonals (a2, c2) must be own; c2 is empty -> false eye.
    expect(eye(noC2, 'b1')).toBe(false);
  });

  it('edge: an empty orthogonal neighbour (a2 empty is a diagonal; b2 empty is not) breaks the eye', () => {
    const ascii = `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 O . O . . . . . .
      1 O . O . . . . . .
    `;
    expect(eye(ascii, 'b1')).toBe(false);
  });

  it('corner: a1 with b1, a2 and b2 own is an eye; without b2 it is not', () => {
    const base = (b2: string) => `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 X ${b2} . . . . . . .
      1 . X . . . . . . .
    `;
    expect(eye(base('X'), 'a1', 'B')).toBe(true);
    expect(eye(base('.'), 'a1', 'B')).toBe(false);
    expect(eye(base('O'), 'a1', 'B')).toBe(false);
  });

  it('centre: two opponent diagonals make a false eye; one is still an eye', () => {
    const ascii = (d1: string, d2: string) => `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . ${d1} X X . . .
      5 . . . X . X . . .
      4 . . . X X ${d2} . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
    `;
    expect(eye(ascii('X', 'X'), 'e5', 'B')).toBe(true);
    expect(eye(ascii('O', 'X'), 'e5', 'B')).toBe(true);
    expect(eye(ascii('O', 'O'), 'e5', 'B')).toBe(false);
  });

  it('an occupied point or a point next to an opponent stone is not an eye', () => {
    const ascii = `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . X X X . . .
      5 . . . X . O . . .
      4 . . . X X X . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
    `;
    expect(eye(ascii, 'e5', 'B')).toBe(false);
    expect(eye(ascii, 'd5', 'B')).toBe(false);
  });
});
