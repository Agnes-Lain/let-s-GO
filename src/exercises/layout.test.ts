import { PRACTICE_FIXED_HEIGHT, boardWidthFor, practiceBoardWidth } from './layout';

const phone = { width: 360, height: 740 };

describe('practice board sizes (AC 84, 88)', () => {
  it('tap-point / play-move use the full 328 px at 360×740', () => {
    expect(practiceBoardWidth('tap-point', phone)).toBe(328);
    expect(practiceBoardWidth('play-move', phone)).toBe(328);
  });

  it('choice shrinks to 220–240 px', () => {
    const w = practiceBoardWidth('choice', phone, 3);
    expect(w).toBeGreaterThanOrEqual(220);
    expect(w).toBeLessThanOrEqual(240);
    expect(practiceBoardWidth('choice', { width: 360, height: 600 }, 4)).toBe(220);
  });

  it('count stays square and ≥ 280 px at 360×740', () => {
    expect(practiceBoardWidth('count', phone)).toBeGreaterThanOrEqual(280);
    expect(practiceBoardWidth('count', phone)).toBeLessThanOrEqual(328);
  });

  it('a short screen shrinks the board instead of scrolling', () => {
    expect(practiceBoardWidth('play-move', { width: 360, height: 600 })).toBe(
      600 - PRACTICE_FIXED_HEIGHT,
    );
    expect(practiceBoardWidth('count', { width: 360, height: 600 })).toBeLessThan(280);
  });

  it('never exceeds 480 px', () => {
    expect(boardWidthFor(2000)).toBe(480);
    expect(practiceBoardWidth('play-move', { width: 1200, height: 1600 })).toBe(480);
  });
});

describe('M5-territory-counting layouts (AC 52–53)', () => {
  it('mark screens keep the 328 px board with the status row', () => {
    expect(practiceBoardWidth('mark', phone)).toBe(328);
  });

  it('count-entry screens keep the 328 px board with the pad (no scroll at 740)', () => {
    expect(practiceBoardWidth('count-entry', phone)).toBe(328);
    // Budget: everything but the board fits in 740 − 16 − 328.
    expect(PRACTICE_FIXED_HEIGHT + 3 * 44 + 3 * 8 - 48 + 328).toBeLessThanOrEqual(740);
  });
});
