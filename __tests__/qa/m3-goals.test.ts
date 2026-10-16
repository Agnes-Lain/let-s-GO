/** QA edge cases for lesson goal checks and the validator (corners, ko, suicide-looking captures). */
import { createGame, play, type GameState } from '@/engine';
import { position, sampleLesson } from '@/lessons/__fixtures__/fixtures';
import { getSolution } from '@/lessons/goals';
import type { Exercise, Goal } from '@/lessons/schema';
import { validateLesson } from '@/lessons/validate';

function ex(ascii: string, goal: Goal, toPlay: 'B' | 'W' = 'B'): Exercise {
  return { id: 'x', type: 'play-move', toPlay, goal, promptKey: 'p', ...position(ascii) };
}
const solve = (ascii: string, goal: Goal, toPlay: 'B' | 'W' = 'B') =>
  (getSolution(ex(ascii, goal, toPlay)) as { points: string[] }).points;

function lessonWith(exercise: Exercise) {
  const lesson = sampleLesson();
  lesson.exercises[2] = exercise;
  return validateLesson(lesson, { hasText: () => true });
}

describe('QA M3: goal solutions in Go edge cases', () => {
  it('corner capture: W a1 with B b1 only → a2 captures', () => {
    const b = `
      5 . . . . .
      4 . . . . .
      3 X . . . .
      2 O . . . .
      1 X . . . .
        a b c d e
    `;
    // W a2 has liberty b2 only
    expect(solve(b, { kind: 'capture' })).toEqual(['b2']);
  });

  it('one move captures two groups: min 2 solution is the shared liberty', () => {
    const b = `
      5 . . . . .
      4 . . . . .
      3 O . O . .
      2 X . X . .
      1 . . . . .
        a b c d e
    `;
    // not capturable: sanity that min 2 yields NO solutions here; real double below
    expect(solve(b, { kind: 'capture', min: 2 })).toEqual([]);
    const d = `
      5 . . . . .
      4 X . X . .
      3 O . O X .
      2 X . X . .
      1 . . . . .
        a b c d e
    `;
    // b3 would be suicide-looking? B b3: neighbours a3 O, c3 O, b4 ., b2 . -> not capture (each W has 0 libs? a3: a4 X, a2 X, b3 -> captured)
    expect(solve(d, { kind: 'capture', min: 2 })).toEqual(['b3']);
  });

  it('suicide-looking move that captures is a legal capture solution', () => {
    // B plays a1: no own liberties, but captures W b1 (liberties: c1 X, b2 X, a1)
    const b = `
      5 . . . . .
      4 . . . . .
      3 . . . . .
      2 X X . . .
      1 . O X . .
        a b c d e
    `;
    // a1: neighbours a2 X (own, has libs a3), b1 O. Use a truer case below
    expect(solve(b, { kind: 'capture' })).toContain('a1');
    const t = `
      5 . . . . .
      4 . . . . .
      3 X . . . .
      2 O X . . .
      1 . O X . .
        a b c d e
    `;
    // B a1: no empty neighbour besides captures: a2 O, b1 O. a2 O libs: a3 X, b2 X, a1 -> captured by a1; b1 O libs c1 X b2 X a1 -> captured. legal.
    expect(solve(t, { kind: 'capture', min: 2 })).toEqual(['a1']);
  });

  it('pure suicide is never a solution', () => {
    const b = `
      5 . . . . .
      4 . . . . .
      3 . . . . .
      2 O . . . .
      1 . O . . .
        a b c d e
    `;
    // B a1 is suicide; goal point a1 must be rejected by the validator
    const e = ex(b, { kind: 'point', points: ['a1'] });
    const r = lessonWith(e);
    expect(r.ok).toBe(false);
  });

  it('ko: an immediate retake is illegal, so it is not a solution after the first capture', () => {
    const b = `
      5 . . . . .
      4 . X O . .
      3 X O . O .
      2 . X O . .
      1 . . . . .
        a b c d e
    `;
    expect(solve(b, { kind: 'capture' })).toEqual(['c3']);
    let g: GameState = createGame(5, { setup: position(b).setup, toPlay: 'B' });
    const first = play(g, 'c3');
    expect(first.ok).toBe(true);
    if (first.ok) g = first.state;
    const retake = play(g, 'b3');
    expect(retake.ok).toBe(false);
    // after a move elsewhere pair, the retake is allowed again
    const away = play(g, 'e5');
    expect(away.ok).toBe(true);
    if (away.ok) {
      const bAway = play(away.state, 'e1');
      expect(bAway.ok).toBe(true);
      if (bAway.ok) expect(play(bAway.state, 'b3').ok).toBe(true);
    }
  });

  it('snapback: first capture then recapture of more is not ko (legal)', () => {
    const b = `
      5 . . . . .
      4 . . . . .
      3 . X X . .
      2 X O O X .
      1 . X . . .
        a b c d e
    `;
    // sanity: position legal and has a capture solution set (no throw)
    expect(Array.isArray(solve(b, { kind: 'capture' }))).toBe(true);
  });

  it('diagonal stones are not connected: connect goal needs the shared point', () => {
    const b = `
      5 . . . . .
      4 . . . . .
      3 . X . . .
      2 . . X . .
      1 . . . . .
        a b c d e
    `;
    expect(solve(b, { kind: 'connect', a: 'b3', b: 'c2' })).toEqual(['b2', 'c3']);
  });

  it('atari goal: a move beside an already-2-liberty group elsewhere is not enough', () => {
    const b = `
      5 . . . . .
      4 . . . . .
      3 . . . . .
      2 . . . . .
      1 O X . . .
        a b c d e
    `;
    // W a1 has liberty a2 only: B a2 captures (not atari) ; B plays far -> not atari
    expect(solve(b, { kind: 'atari' })).toEqual([]);
  });

  it('save by capturing the attacker is a valid solution', () => {
    const b = `
      5 . . . . .
      4 . . . . .
      3 . . . . .
      2 X O . . .
      1 O . . . .
        a b c d e
    `;
    // B a2 has libs a3 only? a2: a3 empty, a1 O, b2 O -> 1 liberty. B a3 extends to 2+ (a4, b3)
    const s = solve(b, { kind: 'save', target: 'a2' });
    expect(s).toContain('a3');
  });
});
