// Lighter bamboo board (spec docs/specs/M5-life-death.md §5.7, AC 45–48): WCAG contrast checks.
import { board, color, stone } from './tokens';

/** WCAG 2.x relative luminance of a #RRGGBB colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, ≥ 1. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrast helper', () => {
  it('black on white is 21:1, a colour on itself 1:1', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#E8D3A0', '#E8D3A0')).toBe(1);
  });
});

// §12b: the spec's node #D9C288 is 1.24:1 against the light strip (AC 47 asks ≤ 1.2), so the
// node is #DDC690 (1.19:1 / 1.07:1 against the strips, 1.14:1 against the base).
describe('AC 45: the §5.7 token values', () => {
  it('board and stone tokens', () => {
    expect(board).toEqual({
      bamboo: '#E8D3A0',
      bambooStripLight: '#EBD8A8',
      bambooStripDark: '#E3CD98',
      bambooNode: '#DDC690',
      line: '#33281B',
    });
    expect(stone).toEqual({ black: '#22252A', white: '#F7F5EE', whiteEdge: '#6B675C' });
  });
});

describe('AC 46: grid and stones stay legible', () => {
  it('grid line vs board ≥ 4.5:1', () => {
    expect(contrast(board.line, board.bamboo)).toBeGreaterThanOrEqual(4.5);
  });
  it('black stone vs board ≥ 3:1', () => {
    expect(contrast(stone.black, board.bamboo)).toBeGreaterThanOrEqual(3);
  });
  it('white-stone edge vs board ≥ 3:1 and vs the white fill ≥ 3:1', () => {
    expect(contrast(stone.whiteEdge, board.bamboo)).toBeGreaterThanOrEqual(3);
    expect(contrast(stone.whiteEdge, stone.white)).toBeGreaterThanOrEqual(3);
  });
});

describe('AC 47: the grain is low contrast', () => {
  const strips = [board.bambooStripLight, board.bambooStripDark];
  it('light vs dark strip ≤ 1.15:1', () => {
    expect(contrast(board.bambooStripLight, board.bambooStripDark)).toBeLessThanOrEqual(1.15);
  });
  it.each(strips)('node vs strip %s ≤ 1.2:1', (strip) => {
    expect(contrast(board.bambooNode, strip)).toBeLessThanOrEqual(1.2);
  });
  it.each(strips)('strip %s vs board base ≤ 1.15:1', (strip) => {
    expect(contrast(strip, board.bamboo)).toBeLessThanOrEqual(1.15);
  });
});

describe('AC 48: rings keep ≥ 3:1 against the board base', () => {
  it.each([
    ['hint', color.hint],
    ['error', color.error],
    ['success', color.success],
  ])('%s ring', (_name, ring) => {
    expect(contrast(ring, board.bamboo)).toBeGreaterThanOrEqual(3);
  });
});
