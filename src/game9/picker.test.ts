// Spec docs/specs/M6-bot-levels.md AC 15, 34, 36, 37.
import { isBeaten, preselectedLevel, showEasierTip } from './picker';

const rec = (wins: number, lossStreak = 0) => ({ games: wins + lossStreak, wins, lossStreak });

describe('level picker', () => {
  it('AC 15: Easy until any win, then Normal (AC 36)', () => {
    expect(preselectedLevel({})).toBe(1);
    expect(preselectedLevel({ '1': rec(0, 2) })).toBe(1);
    expect(preselectedLevel({ '1': rec(1) })).toBe(2);
    expect(preselectedLevel({ '3': rec(1) })).toBe(2);
  });

  it('AC 34: a level is beaten after one win', () => {
    expect(isBeaten({ '3': rec(1) }, 3)).toBe(true);
    expect(isBeaten({ '3': rec(0, 1) }, 3)).toBe(false);
    expect(isBeaten({}, 1)).toBe(false);
  });

  it('AC 37: the tip shows after 3 losses in a row at Normal or Challenge, once', () => {
    expect(showEasierTip({ '2': rec(0, 2) }, {})).toBe(false);
    expect(showEasierTip({ '2': rec(0, 3) }, {})).toBe(true);
    expect(showEasierTip({ '3': rec(1, 3) }, {})).toBe(true);
    expect(showEasierTip({ '1': rec(0, 5) }, {})).toBe(false);
    expect(showEasierTip({ '2': rec(0, 3) }, { easierTipShown: true })).toBe(false);
  });
});
