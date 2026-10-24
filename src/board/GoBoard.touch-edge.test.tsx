// QA: touch edge cases for GoBoard (drag, board edge, second touch, non-interactive).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { GoBoard } from './GoBoard';
import { boardGeometry, pointToLocation, stonesFromSetup } from './geometry';

const g = boardGeometry(9, 328, true);
type Phase = 'responderGrant' | 'responderMove' | 'responderRelease' | 'responderTerminate';
async function touch(phase: Phase, x = 0, y = 0) {
  await fireEvent(screen.getByTestId('board-touch'), phase, {
    nativeEvent: { locationX: x, locationY: y },
  });
}
const at = (x: number, y: number) => pointToLocation(g, { x, y });

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

async function setup(extra: Partial<Parameters<typeof GoBoard>[0]> = {}) {
  const onPlay = jest.fn();
  const onIllegal = jest.fn();
  await render(
    <GoBoard
      size={9}
      stones={stonesFromSetup(9, {})}
      width={328}
      interactive
      onPlay={onPlay}
      onIllegal={onIllegal}
      {...extra}
    />,
  );
  return { onPlay, onIllegal };
}

describe('touch edge cases', () => {
  it('a long drag across every column ends on the last point only', async () => {
    const { onPlay } = await setup();
    const start = at(0, 4);
    await touch('responderGrant', start.x, start.y);
    for (let x = 1; x <= 8; x += 1) {
      const p = at(x, 4);
      await touch('responderMove', p.x, p.y);
      expect(screen.getByTestId('board-ghost').props.cx).toBeCloseTo(p.x, 1);
    }
    const end = at(8, 4);
    await touch('responderRelease', end.x, end.y);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledWith({ x: 8, y: 4 });
  });

  it('release at a different spot than the last move uses the release location', async () => {
    const { onPlay } = await setup();
    const a = at(2, 2);
    const b = at(6, 6);
    await touch('responderGrant', a.x, a.y);
    await touch('responderRelease', b.x, b.y);
    expect(onPlay).toHaveBeenCalledWith({ x: 6, y: 6 });
  });

  it('touching exactly on the corner intersection plays the corner', async () => {
    const { onPlay } = await setup();
    const p = at(0, 0);
    await touch('responderGrant', p.x, p.y);
    await touch('responderRelease', p.x, p.y);
    expect(onPlay).toHaveBeenCalledWith({ x: 0, y: 0 });
  });

  it('touch-up just inside the half-cell margin still plays the edge point, just outside cancels', async () => {
    const { onPlay } = await setup();
    const p = at(8, 4);
    await touch('responderGrant', p.x, p.y);
    await touch('responderRelease', p.x + g.cell * 0.49, p.y);
    expect(onPlay).toHaveBeenCalledWith({ x: 8, y: 4 });
    onPlay.mockClear();
    await touch('responderGrant', p.x, p.y);
    await touch('responderMove', p.x + g.cell * 0.51, p.y);
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    await touch('responderRelease', p.x + g.cell * 0.51, p.y);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('left, top and bottom margins behave the same (0.49 in, 0.51 out)', async () => {
    const { onPlay } = await setup();
    const p = at(0, 0);
    await touch('responderGrant', p.x - g.cell * 0.49, p.y + g.cell * 0.49);
    await touch('responderRelease', p.x - g.cell * 0.49, p.y + g.cell * 0.49);
    expect(onPlay).toHaveBeenLastCalledWith({ x: 0, y: 0 });
    await touch('responderGrant', p.x - g.cell * 0.51, p.y);
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    await touch('responderRelease', p.x - g.cell * 0.51, p.y);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('a second touch during a preview does not move the ghost or double-fire', async () => {
    const { onPlay, onIllegal } = await setup();
    const a = at(4, 4);
    const b = at(1, 1);
    await touch('responderGrant', a.x, a.y);
    await touch('responderGrant', b.x, b.y);
    expect(screen.getByTestId('board-ghost').props.cx).toBeCloseTo(a.x, 1);
    await touch('responderRelease', a.x, a.y);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledWith({ x: 4, y: 4 });
    expect(onIllegal).not.toHaveBeenCalled();
    expect(screen.queryByTestId('board-ghost')).toBeNull();
  });

  it('a new touch after a finished one works (state is reset)', async () => {
    const { onPlay } = await setup();
    const a = at(4, 4);
    const b = at(1, 1);
    await touch('responderGrant', a.x, a.y);
    await touch('responderRelease', a.x, a.y);
    await touch('responderGrant', b.x, b.y);
    await touch('responderRelease', b.x, b.y);
    expect(onPlay).toHaveBeenCalledTimes(2);
    expect(onPlay).toHaveBeenLastCalledWith({ x: 1, y: 1 });
  });

  it('a terminated gesture can be followed by a normal one', async () => {
    const { onPlay } = await setup();
    const a = at(4, 4);
    await touch('responderGrant', a.x, a.y);
    await touch('responderTerminate');
    await touch('responderGrant', a.x, a.y);
    await touch('responderRelease', a.x, a.y);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('a board without interactive has no touch surface, no ghost, no callbacks', async () => {
    const onPlay = jest.fn();
    await render(<GoBoard size={9} stones={stonesFromSetup(9, {})} width={328} onPlay={onPlay} />);
    expect(screen.queryByTestId('board-touch')).toBeNull();
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('disabled board: move and release do nothing', async () => {
    const { onPlay, onIllegal } = await setup({ disabled: true });
    const a = at(4, 4);
    await touch('responderGrant', a.x, a.y);
    await touch('responderMove', a.x, a.y);
    await touch('responderRelease', a.x, a.y);
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    expect(onPlay).not.toHaveBeenCalled();
    expect(onIllegal).not.toHaveBeenCalled();
  });

  it('dragging from a legal to an illegal point switches ghost to ring and back', async () => {
    const { onPlay, onIllegal } = await setup({
      stones: stonesFromSetup(9, { W: ['f5'] }),
    });
    const a = at(4, 4);
    const b = at(5, 4);
    await touch('responderGrant', a.x, a.y);
    expect(screen.getByTestId('board-ghost')).toBeTruthy();
    await touch('responderMove', b.x, b.y);
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    expect(screen.getByTestId('board-illegal-ring')).toBeTruthy();
    await touch('responderMove', a.x, a.y);
    expect(screen.getByTestId('board-ghost')).toBeTruthy();
    expect(screen.queryByTestId('board-illegal-ring')).toBeNull();
    await touch('responderRelease', a.x, a.y);
    expect(onPlay).toHaveBeenCalledWith({ x: 4, y: 4 });
    expect(onIllegal).not.toHaveBeenCalled();
  });

  it('19x19 touch maps to the right point', async () => {
    const g19 = boardGeometry(19, 328, true);
    const onPlay = jest.fn();
    await render(
      <GoBoard
        size={19}
        stones={stonesFromSetup(19, {})}
        width={328}
        interactive
        onPlay={onPlay}
      />,
    );
    const p = pointToLocation(g19, { x: 9, y: 9 });
    await touch('responderGrant', p.x, p.y);
    await touch('responderRelease', p.x, p.y);
    expect(onPlay).toHaveBeenCalledWith({ x: 9, y: 9 });
  });

  it('exactly half a cell beyond any outer line is treated alike on all four sides', async () => {
    const { onPlay } = await setup();
    const c = at(0, 0);
    const far = at(8, 8);
    const spots = [
      [c.x - g.cell / 2, c.y], // left of a1 column
      [far.x + g.cell / 2, far.y], // right of j-column
      [c.x, c.y + g.cell / 2], // below row 1
      [far.x, far.y - g.cell / 2], // above row 9
    ];
    const results: number[] = [];
    for (const [x, y] of spots) {
      onPlay.mockClear();
      await touch('responderGrant', x, y);
      await touch('responderRelease', x, y);
      results.push(onPlay.mock.calls.length);
    }
    expect(new Set(results).size).toBe(1);
  });
});
