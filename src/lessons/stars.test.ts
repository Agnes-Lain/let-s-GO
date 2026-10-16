import type { Outcome } from './schema';
import { computeStars, countOutcomes } from './stars';

const CODE: Record<string, Outcome> = { C: 'clean', S: 'solved', R: 'revealed' };
const outcomes = (code: string) => [...code].map((c) => CODE[c]);

describe('computeStars (AC 31)', () => {
  it.each([
    ['CCCCCC', 3],
    ['CCCCCR', 3],
    ['CCCCSS', 2],
    ['CCCCSR', 2],
    ['CCCSSR', 2],
    ['CCSSRR', 1],
    ['CCCRRR', 1],
    ['CSRRRR', 0],
    ['RRRRRR', 0],
    ['CCCCR', 3],
    ['CCCSR', 2],
    ['CCSRR', 1],
    ['CSRRR', 0],
    ['CRRRR', 0],
    ['CSSSSS', 2],
    ['SSSSSS', 2],
  ])('%s → %d★', (code, stars) => {
    expect(computeStars(outcomes(code))).toBe(stars);
  });

  it('an empty list is 0★', () => {
    expect(computeStars([])).toBe(0);
  });

  it('order does not matter', () => {
    expect(computeStars(outcomes('RCCCSC'))).toBe(computeStars(outcomes('CCCCSR')));
    expect(computeStars(outcomes('RRRCCC'))).toBe(1);
  });

  it('counts clean and solved', () => {
    expect(countOutcomes(outcomes('CCSR'))).toEqual({ clean: 2, solved: 3, total: 4 });
  });
});
