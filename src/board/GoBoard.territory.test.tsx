// Territory squares, scratch dots and dead stones (spec docs/specs/M5-territory-counting.md §5.5,
// AC 23, 31, 45, 55): drawn with existing tokens only, under the stones, never as rings.
import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { opacity, stone, color } from '@/theme/tokens';

import { GoBoard, type Highlight, type Marker } from './GoBoard';
import { boardGeometry, stonesFromSetup } from './geometry';

const stones = stonesFromSetup(5, { B: ['b2'], W: ['d4'] });
const at = (x: number, y: number) => ({ x, y });
const payload = (c: string) => ({ type: 0, payload: processColor(c) });

async function draw(highlights: Highlight[], markers: Marker[] = []) {
  await render(
    <GoBoard size={5} stones={stones} width={328} highlights={highlights} markers={markers} />,
  );
}

describe('territory squares and scratch dots', () => {
  it('black squares: 36 % of the cell in stone.black; white: stone.white with the 1.5 px edge', async () => {
    await draw([
      { kind: 'territoryB', points: [at(0, 0)] },
      { kind: 'territoryW', points: [at(4, 4)] },
    ]);
    const g = boardGeometry(5, 328, true);
    const b = screen.getByTestId('board-territory-B-a1');
    expect(b.props.width).toBeCloseTo(0.36 * g.cell, 3);
    expect(b.props.fill).toEqual(payload(stone.black));
    const w = screen.getByTestId('board-territory-W-e5');
    expect(w.props.fill).toEqual(payload(stone.white));
    expect(w.props.stroke).toEqual(payload(stone.whiteEdge));
    expect(w.props.strokeWidth).toBe(1.5);
    // Not drawn as rings.
    expect(screen.queryAllByTestId(/^board-highlight-territory/)).toHaveLength(0);
  });

  it('scratch dots: a small textSecondary ring, 40 % of the cell', async () => {
    await draw([{ kind: 'scratch', points: [at(2, 2)] }]);
    const g = boardGeometry(5, 328, true);
    const dot = screen.getByTestId('board-scratch-c3');
    expect(dot.props.stroke).toEqual(payload(color.textSecondary));
    expect(2 * dot.props.r).toBeCloseTo(0.4 * g.cell, 3);
    expect(screen.queryAllByTestId(/^board-highlight-scratch/)).toHaveLength(0);
  });
});

describe('dead stones', () => {
  it('are dimmed to 45 % with a cross in the contrast colour', async () => {
    await draw(
      [],
      [
        { kind: 'dead', point: at(1, 1) },
        { kind: 'dead', point: at(3, 3) },
      ],
    );
    expect(screen.getByTestId('board-stone-b2').props.opacity).toBe(opacity.dead);
    expect(screen.getByTestId('board-stone-d4').props.opacity).toBe(opacity.dead);
    const crossOnBlack = screen.getByTestId('board-marker-dead-b2');
    const crossOnWhite = screen.getByTestId('board-marker-dead-d4');
    expect(crossOnBlack.props.children[0].props.stroke).toBe(stone.white);
    expect(crossOnWhite.props.children[0].props.stroke).toBe(stone.black);
  });

  it('other stones keep full opacity', async () => {
    await draw([], [{ kind: 'dead', point: at(1, 1) }]);
    expect(screen.getByTestId('board-stone-d4').props.opacity).toBeUndefined();
  });
});
