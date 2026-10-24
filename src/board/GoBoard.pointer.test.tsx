// M3 §12: `pointer="ring"` previews a thin accent ring instead of a ghost stone (tap-point).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, processColor } from 'react-native';

import { parseVertex } from '@/engine';
import { color } from '@/theme/tokens';

import { GoBoard } from './GoBoard';
import { boardGeometry, pointToLocation, stonesFromSetup } from './geometry';

const stones = stonesFromSetup(5, { B: ['c2', 'b3', 'd3'], W: ['c3'] });
const g = boardGeometry(5, 328, false);
const at = (v: string) => pointToLocation(g, parseVertex(v, 5));

async function touch(phase: 'responderGrant' | 'responderRelease', v: string) {
  const { x, y } = at(v);
  await fireEvent(screen.getByTestId('board-touch'), phase, {
    nativeEvent: { locationX: x, locationY: y },
  });
}

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

describe('pointer="ring"', () => {
  it('shows a ring, not a ghost stone, and accepts occupied points when checkPoint allows', async () => {
    const onPlay = jest.fn();
    await render(
      <GoBoard
        size={5}
        stones={stones}
        width={328}
        showCoordinates={false}
        interactive
        pointer="ring"
        checkPoint={() => ({ legal: true })}
        onPlay={onPlay}
      />,
    );
    await touch('responderGrant', 'c3');
    const ring = screen.getByTestId('board-pointer-ring');
    expect(ring.props.stroke).toEqual({ type: 0, payload: processColor(color.accent) });
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    await touch('responderRelease', 'c3');
    expect(onPlay).toHaveBeenCalledWith({ x: 2, y: 2 });
    expect(screen.queryByTestId('board-pointer-ring')).toBeNull();
  });

  it('the default pointer is still the ghost stone', async () => {
    await render(
      <GoBoard size={5} stones={stones} width={328} showCoordinates={false} interactive />,
    );
    await touch('responderGrant', 'a1');
    expect(screen.getByTestId('board-ghost')).toBeTruthy();
    expect(screen.queryByTestId('board-pointer-ring')).toBeNull();
  });
});
