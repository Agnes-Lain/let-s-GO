// Route parameters of app/game/play (M6 bot-levels; M6-beginner-friendly AC 14).
import { parseHandicap, parseLevel } from './levelParam';

describe('the level route parameter', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['3', 3],
    [undefined, 2],
    ['4', 2],
    ['x', 2],
  ])('%p → %p', (value, expected) => expect(parseLevel(value)).toBe(expected));
});

describe('the handicap route parameter (AC 14)', () => {
  it.each([
    ['3', 3],
    ['0', 0],
    ['5', 5],
    [undefined, 0],
    ['', 0],
    ['1', 0],
    ['6', 0],
    ['2.5', 0],
    ['abc', 0],
    [' 3', 0],
  ])('%p → %p', (value, expected) => expect(parseHandicap(value)).toBe(expected));
});
