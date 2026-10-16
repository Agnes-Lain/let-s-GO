import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import type { BoardSize } from '@/engine';
import { board, color, stone } from '@/theme/tokens';

import { GoBoard, type Marker } from './GoBoard';
import { boardGeometry, columnLabels, starPoints, stonesFromSetup } from './geometry';

const payload = (c: string) => ({ type: 0, payload: processColor(c) });
const prop = (id: string, name: string) => screen.getByTestId(id).props[name];

describe('QA edge cases: stars, labels, geometry', () => {
  it.each([5, 7, 9, 13, 19] as BoardSize[])(
    'size %i draws exactly its star points (AC3/AC14)',
    (s) => {
      render(<GoBoard size={s} stones={stonesFromSetup(s, {})} width={328} />);
      const ids = screen
        .queryAllByTestId(/^board-star-/)
        .map((e) => e.props.testID.slice('board-star-'.length))
        .sort();
      expect(ids).toEqual([...starPoints(s)].sort());
    },
  );

  it('7x7 has the centre star only (PO decision 1)', () => {
    render(<GoBoard size={7} stones={stonesFromSetup(7, {})} width={328} />);
    expect(screen.queryAllByTestId(/^board-star-/)).toHaveLength(1);
    const g = boardGeometry(7, 328, true);
    expect(screen.getByTestId('board-star-d4').props.cx).toBeCloseTo(g.origin + 3 * g.cell, 2);
    expect(screen.getByTestId('board-star-d4').props.cy).toBeCloseTo(164, 2);
  });

  it('19x19 letters skip I and have 19 columns and 19 rows', () => {
    render(<GoBoard size={19} stones={stonesFromSetup(19, {})} width={328} />);
    expect(screen.queryByTestId('board-label-col-I')).toBeNull();
    expect(screen.getByTestId('board-label-col-T')).toBeTruthy();
    expect(screen.queryAllByTestId(/^board-label-col-/)).toHaveLength(19);
    expect(screen.queryAllByTestId(/^board-label-row-/)).toHaveLength(19);
    expect(columnLabels(19).join('')).not.toContain('I');
  });

  it('star points sit exactly on grid intersections for every size and coordinate mode', () => {
    for (const s of [5, 7, 9, 13, 19] as BoardSize[]) {
      for (const coords of [true, false]) {
        const { unmount } = render(
          <GoBoard size={s} stones={stonesFromSetup(s, {})} width={328} showCoordinates={coords} />,
        );
        const g = boardGeometry(s, 328, coords);
        for (const el of screen.queryAllByTestId(/^board-star-/)) {
          const col = (el.props.cx - g.origin) / g.cell;
          const row = (el.props.cy - g.origin) / g.cell;
          expect(col).toBeCloseTo(Math.round(col), 6);
          expect(row).toBeCloseTo(Math.round(row), 6);
        }
        unmount();
      }
    }
  });

  it('the board is always square and the grid spans origin..width-origin', () => {
    for (const s of [5, 7, 9, 13, 19] as BoardSize[]) {
      for (const coords of [true, false]) {
        const g = boardGeometry(s, 328, coords);
        expect(g.origin * 2 + (s - 1) * g.cell).toBeCloseTo(328, 6);
      }
    }
  });
});

describe('QA edge cases: stones', () => {
  it('stones are centred exactly on intersections incl. corners (a1, j9)', () => {
    render(
      <GoBoard
        size={9}
        stones={stonesFromSetup(9, { B: ['a1', 'j9'], W: ['a9', 'j1'] })}
        width={328}
      />,
    );
    const g = boardGeometry(9, 328, true);
    const exp = (id: string, cx: number, cy: number) => {
      expect(prop(id, 'cx')).toBeCloseTo(cx, 2);
      expect(prop(id, 'cy')).toBeCloseTo(cy, 2);
    };
    const far = g.origin + 8 * g.cell;
    exp('board-stone-a1', g.origin, far);
    exp('board-stone-j9', far, g.origin);
    exp('board-stone-a9', g.origin, g.origin);
    exp('board-stone-j1', far, far);
  });

  it('stone fills use the stone tokens; white has the edge stroke, black has none (AC11)', () => {
    render(<GoBoard size={9} stones={stonesFromSetup(9, { B: ['e5'], W: ['c6'] })} width={328} />);
    expect(prop('board-stone-e5', 'fill')).toEqual(payload(stone.black));
    expect(prop('board-stone-e5', 'stroke')).toBeUndefined();
    expect(prop('board-stone-c6', 'fill')).toEqual(payload(stone.white));
    expect(prop('board-stone-c6', 'stroke')).toEqual(payload(stone.whiteEdge));
  });

  it('a full board draws size*size stones; an empty array of correct length draws none', () => {
    render(
      <GoBoard size={5} stones={Array.from({ length: 25 }, () => 'B' as const)} width={328} />,
    );
    expect(screen.queryAllByTestId(/^board-stone-/)).toHaveLength(25);
  });

  it.each([[[]], [Array.from({ length: 82 }, () => null)]])(
    'empty or too-long stones array renders no stones, no crash, one warning (AC12)',
    (stones) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      render(<GoBoard size={9} stones={stones} width={328} />);
      expect(screen.queryAllByTestId(/^board-stone-/)).toHaveLength(0);
      expect(screen.getByTestId('board-grid-h-8')).toBeTruthy();
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    },
  );

  it('does not warn for a correct stones array', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(<GoBoard size={9} stones={stonesFromSetup(9, {})} width={328} />);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('interactive=true still renders no touch surface in PR 1 (AC13 default false)', () => {
    render(<GoBoard size={9} stones={stonesFromSetup(9, {})} width={328} />);
    expect(screen.queryByTestId('board-touch')).toBeNull();
  });
});

describe('QA edge cases: markers and highlights', () => {
  const stones = stonesFromSetup(9, { B: ['e5'], W: ['c3'] });

  it('marker strokes follow the stone underneath (AC16 colours)', () => {
    render(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        markers={[
          { kind: 'circle', point: { x: 4, y: 4 } },
          { kind: 'triangle', point: { x: 2, y: 2 } },
          { kind: 'square', point: { x: 3, y: 3 } },
          { kind: 'cross', point: { x: 5, y: 5 } },
          { kind: 'circle', point: { x: 0, y: 0 } },
        ]}
      />,
    );
    expect(prop('board-marker-circle-e5', 'stroke')).toEqual(payload(stone.white));
    expect(prop('board-marker-triangle-c3', 'stroke')).toEqual(payload(board.line));
    expect(prop('board-marker-square-d4', 'stroke')).toEqual(payload(board.line));
    expect(prop('board-marker-circle-a1', 'stroke')).toEqual(payload(board.line));
    for (const id of ['circle-e5', 'triangle-c3', 'square-d4', 'circle-a1']) {
      expect(prop(`board-marker-${id}`, 'strokeWidth')).toBe(2);
      expect(prop(`board-marker-${id}`, 'fill')).toBeNull();
    }
  });

  it('marker sizes scale with the cell (circle 0.25, square 0.44)', () => {
    render(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        markers={[
          { kind: 'circle', point: { x: 4, y: 4 } },
          { kind: 'square', point: { x: 3, y: 3 } },
        ]}
      />,
    );
    expect(prop('board-marker-circle-e5', 'r')).toBeCloseTo(0.25 * 32.8, 2);
    expect(Number(prop('board-marker-square-d4', 'width'))).toBeCloseTo(0.44 * 32.8, 2);
  });

  it('a label on an occupied point has no mask disc; on an empty point it does (AC17)', () => {
    const markers: Marker[] = [
      { kind: 'label', point: { x: 4, y: 4 }, text: 'A' },
      { kind: 'label', point: { x: 0, y: 8 }, text: 'B' },
    ];
    render(<GoBoard size={9} stones={stones} width={328} markers={markers} />);
    expect(screen.queryByTestId('board-marker-label-mask-e5')).toBeNull();
    const mask = screen.getByTestId('board-marker-label-mask-a9');
    expect(mask.props.fill).toEqual(payload(board.bamboo));
  });

  it('mask disc is drawn before (below) its text', () => {
    render(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        markers={[{ kind: 'label', point: { x: 1, y: 1 }, text: 'A' }]}
      />,
    );
    const order = screen.queryAllByTestId(/^board-marker-label/).map((e) => e.props.testID);
    expect(order.indexOf('board-marker-label-mask-b2')).toBeLessThan(
      order.indexOf('board-marker-label-b2'),
    );
  });

  it('markers render above stones', () => {
    render(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        markers={[{ kind: 'circle', point: { x: 4, y: 4 } }]}
      />,
    );
    const all = screen.queryAllByTestId(/^board-(marker|stone)-/).map((e) => e.props.testID);
    expect(all.indexOf('board-marker-circle-e5')).toBeGreaterThan(all.indexOf('board-stone-e5'));
  });

  it('a liberty highlight and a stone on the same point: stone is drawn above', () => {
    render(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        highlights={[{ kind: 'liberty', points: [{ x: 4, y: 4 }] }]}
      />,
    );
    const all = screen
      .queryAllByTestId(/^board-(highlight-liberty|stone)-/)
      .map((e) => e.props.testID);
    expect(all.indexOf('board-highlight-liberty-e5')).toBeLessThan(all.indexOf('board-stone-e5'));
  });

  it('liberty fill/stroke use color.accent; success/error/hint use their tokens (AC18-20)', () => {
    render(
      <GoBoard
        size={9}
        stones={stones}
        width={328}
        highlights={[
          { kind: 'liberty', points: [{ x: 1, y: 2 }] },
          { kind: 'success', points: [{ x: 3, y: 3 }] },
          { kind: 'error', points: [{ x: 4, y: 4 }] },
          { kind: 'hint', points: [{ x: 3, y: 2 }] },
        ]}
      />,
    );
    expect(prop('board-highlight-liberty-b3', 'fill')).toEqual(payload(color.accent));
    expect(prop('board-highlight-liberty-b3', 'stroke')).toEqual(payload(color.accent));
    expect(prop('board-highlight-success-d4', 'stroke')).toEqual(payload(color.success));
    expect(prop('board-highlight-error-e5', 'stroke')).toEqual(payload(color.error));
    expect(prop('board-highlight-hint-d3', 'stroke')).toEqual(payload(color.hint));
    expect(prop('board-highlight-success-d4', 'r')).toBeCloseTo(16.4, 2);
    expect(prop('board-highlight-error-e5', 'fill')).toBeNull();
  });

  it('empty markers/highlights render nothing extra', () => {
    render(
      <GoBoard size={9} stones={stonesFromSetup(9, {})} width={328} markers={[]} highlights={[]} />,
    );
    expect(screen.queryAllByTestId(/^board-(marker|highlight)-/)).toHaveLength(0);
  });
});
