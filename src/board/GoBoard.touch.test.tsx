// M2 PR 2 — touch preview & commit (AC21-AC34).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, processColor } from 'react-native';

import { checkMove, createGame } from '@/engine';
import type { Point } from '@/engine';
import { color, stone } from '@/theme/tokens';

import { GoBoard, type Marker } from './GoBoard';
import { boardGeometry, pointToLocation, stonesFromSetup } from './geometry';

const payload = (c: string) => ({ type: 0, payload: processColor(c) });
const empty9 = stonesFromSetup(9, {});

type Phase = 'responderGrant' | 'responderMove' | 'responderRelease' | 'responderTerminate';
function touch(phase: Phase, x = 0, y = 0) {
  fireEvent(screen.getByTestId('board-touch'), phase, {
    nativeEvent: { locationX: x, locationY: y },
  });
}
const text = (id: string) =>
  screen
    .getByTestId(id)
    .findAll((n) => String(n.type) === 'RNSVGTSpan' && typeof n.props.content === 'string')
    .map((n) => n.props.content as string)
    .join('');

// useReduceMotion starts at "reduced" (true); answering true keeps renders quiet.
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

describe('touch preview & commit, 9x9 (AC21-AC27)', () => {
  const setup = (extra: Partial<Parameters<typeof GoBoard>[0]> = {}) => {
    const onPlay = jest.fn();
    const onIllegal = jest.fn();
    render(
      <GoBoard
        size={9}
        stones={empty9}
        width={328}
        interactive
        onPlay={onPlay}
        onIllegal={onIllegal}
        {...extra}
      />,
    );
    return { onPlay, onIllegal };
  };

  it('AC21: grant shows a half-transparent black ghost at e5 and calls nothing', () => {
    const { onPlay, onIllegal } = setup();
    touch('responderGrant', 164, 164);
    const ghost = screen.getByTestId('board-ghost');
    expect(ghost.props.cx).toBeCloseTo(164, 1);
    expect(ghost.props.cy).toBeCloseTo(164, 1);
    expect(ghost.props.fill).toEqual(payload(stone.black));
    expect(ghost.props.opacity).toBe(0.5);
    expect(onPlay).not.toHaveBeenCalled();
    expect(onIllegal).not.toHaveBeenCalled();
  });

  it('AC22: release commits once, removes the ghost and draws no stone itself', () => {
    const { onPlay } = setup();
    touch('responderGrant', 164, 164);
    touch('responderRelease', 164, 164);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledWith({ x: 4, y: 4 });
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    expect(screen.queryByTestId('board-stone-e5')).toBeNull();
  });

  it('AC23: dragging snaps the ghost to f5 then f6; release plays f6', () => {
    const { onPlay } = setup();
    touch('responderGrant', 164, 164);
    touch('responderMove', 197, 164);
    expect(screen.getByTestId('board-ghost').props.cx).toBeCloseTo(196.8, 1);
    expect(screen.getByTestId('board-ghost').props.cy).toBeCloseTo(164, 1);
    touch('responderMove', 197, 131);
    expect(screen.getByTestId('board-ghost').props.cy).toBeCloseTo(131.2, 1);
    touch('responderRelease', 197, 131);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledWith({ x: 5, y: 5 });
  });

  it('AC24: leaving the board hides the ghost; releasing there cancels', () => {
    const { onPlay, onIllegal } = setup();
    touch('responderGrant', 164, 164);
    touch('responderMove', 164, 330);
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    touch('responderRelease', 164, 330);
    expect(onPlay).not.toHaveBeenCalled();
    expect(onIllegal).not.toHaveBeenCalled();
  });

  it('AC25: coming back onto the board shows the ghost again', () => {
    const { onPlay } = setup();
    touch('responderGrant', 164, 164);
    touch('responderMove', 164, 330);
    touch('responderMove', 164, 164);
    expect(screen.getByTestId('board-ghost').props.cx).toBeCloseTo(164, 1);
    touch('responderRelease', 164, 164);
    expect(onPlay).toHaveBeenCalledWith({ x: 4, y: 4 });
  });

  it('AC26: a terminated gesture (parent took the responder) cancels silently', () => {
    const { onPlay, onIllegal } = setup();
    touch('responderGrant', 164, 164);
    touch('responderTerminate');
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    expect(onPlay).not.toHaveBeenCalled();
    expect(onIllegal).not.toHaveBeenCalled();
  });

  it('AC27: the white ghost uses stone.white with the white edge', () => {
    setup({ playerColor: 'W' });
    touch('responderGrant', 164, 164);
    const ghost = screen.getByTestId('board-ghost');
    expect(ghost.props.fill).toEqual(payload(stone.white));
    expect(ghost.props.stroke).toEqual(payload(stone.whiteEdge));
    expect(ghost.props.opacity).toBe(0.5);
  });

  it('refuses to give the responder away to a parent (termination request)', () => {
    setup();
    expect(screen.getByTestId('board-touch').props.onResponderTerminationRequest()).toBe(false);
  });

  it('ignores a second grant while a touch is active', () => {
    const { onPlay } = setup();
    touch('responderGrant', 164, 164);
    touch('responderGrant', 32.8, 32.8);
    expect(screen.getByTestId('board-ghost').props.cx).toBeCloseTo(164, 1);
    touch('responderRelease', 164, 164);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});

describe('illegal points (AC28-AC30)', () => {
  afterEach(() => jest.useRealTimers());

  it('AC28: forbidden a1 shows a dashed ring, reports suicide, fades out after 700 ms', () => {
    jest.useFakeTimers();
    const state = createGame(5, { setup: { B: ['a2', 'b1', 'c3'], W: ['d3', 'c4'] }, toPlay: 'W' });
    const onPlay = jest.fn();
    const onIllegal = jest.fn();
    render(
      <GoBoard
        size={5}
        stones={state.board.cells}
        width={328}
        interactive
        playerColor="W"
        checkPoint={(p) => checkMove(state, p)}
        onPlay={onPlay}
        onIllegal={onIllegal}
      />,
    );
    const a1 = pointToLocation(boardGeometry(5, 328, true), { x: 0, y: 0 });
    expect(a1.x).toBeCloseTo(54.67, 1);
    touch('responderGrant', a1.x, a1.y);
    const ring = screen.getByTestId('board-illegal-ring');
    expect(ring.props.cx).toBeCloseTo(a1.x, 1);
    expect(ring.props.cy).toBeCloseTo(a1.y, 1);
    expect(ring.props.stroke).toEqual(payload(color.error));
    expect(ring.props.strokeDasharray).toEqual(['4', '3']);
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    expect(onIllegal).not.toHaveBeenCalled();

    touch('responderRelease', a1.x, a1.y);
    expect(onIllegal).toHaveBeenCalledTimes(1);
    expect(onIllegal).toHaveBeenCalledWith({ x: 0, y: 0 }, 'suicide');
    expect(onPlay).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(600));
    expect(screen.getByTestId('board-illegal-ring')).toBeTruthy();
    act(() => jest.advanceTimersByTime(100));
    expect(screen.queryByTestId('board-illegal-ring')).toBeNull();
  });

  it('AC29: without checkPoint an occupied point is illegal (ring around the stone)', () => {
    const onIllegal = jest.fn();
    const onPlay = jest.fn();
    render(
      <GoBoard
        size={9}
        stones={stonesFromSetup(9, { B: ['e5'] })}
        width={328}
        interactive
        onPlay={onPlay}
        onIllegal={onIllegal}
      />,
    );
    touch('responderGrant', 164, 164);
    expect(screen.getByTestId('board-illegal-ring').props.cx).toBeCloseTo(164, 1);
    touch('responderRelease', 164, 164);
    expect(onIllegal).toHaveBeenCalledTimes(1);
    expect(onIllegal).toHaveBeenCalledWith({ x: 4, y: 4 }, 'occupied');
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('AC30: disabled gives no ghost and no callbacks', () => {
    const onPlay = jest.fn();
    const onIllegal = jest.fn();
    render(
      <GoBoard
        size={9}
        stones={empty9}
        width={328}
        interactive
        disabled
        onPlay={onPlay}
        onIllegal={onIllegal}
      />,
    );
    touch('responderGrant', 164, 164);
    expect(screen.queryByTestId('board-ghost')).toBeNull();
    touch('responderRelease', 164, 164);
    expect(onPlay).not.toHaveBeenCalled();
    expect(onIllegal).not.toHaveBeenCalled();
  });

  it('a board that is not interactive has no touch surface', () => {
    render(<GoBoard size={9} stones={empty9} width={328} />);
    expect(screen.queryByTestId('board-touch')).toBeNull();
  });

  it('locking the board mid-touch removes the preview', () => {
    const props = { size: 9 as const, stones: empty9, width: 328, interactive: true };
    const { rerender } = render(<GoBoard {...props} />);
    touch('responderGrant', 164, 164);
    expect(screen.getByTestId('board-ghost')).toBeTruthy();
    rerender(<GoBoard {...props} disabled />);
    expect(screen.queryByTestId('board-ghost')).toBeNull();
  });
});

describe('crosshair and coordinate tag (AC31-AC32)', () => {
  it('AC31: 9x9 shows crosshair, tag E5 above the point and accent labels', () => {
    render(<GoBoard size={9} stones={empty9} width={328} interactive />);
    touch('responderGrant', 164, 164);
    expect(screen.getByTestId('board-crosshair')).toBeTruthy();
    const tag = screen.getByTestId('board-coord-tag').props;
    expect(text('board-coord-tag-text')).toBe('E5');
    const tagText = screen.getByTestId('board-coord-tag-text').props;
    expect(Number(tagText.x)).toBeCloseTo(164, 1);
    expect(tag.x + tag.width / 2).toBeCloseTo(164, 1);
    expect(tag.y + tag.height / 2).toBeCloseTo(90.2, 1);
    expect(screen.getByTestId('board-label-col-E').props.fill).toEqual(payload(color.accent));
    expect(screen.getByTestId('board-label-row-5').props.fill).toEqual(payload(color.accent));
    expect(screen.getByTestId('board-label-col-D').props.fill).not.toEqual(payload(color.accent));
    touch('responderRelease', 164, 164);
    expect(screen.queryByTestId('board-crosshair')).toBeNull();
    expect(screen.getByTestId('board-label-col-E').props.fill).not.toEqual(payload(color.accent));
  });

  it('AC31: the tag goes beside the point when it would leave the top', () => {
    render(<GoBoard size={9} stones={empty9} width={328} interactive />);
    touch('responderGrant', 164, 32.8);
    const tag = screen.getByTestId('board-coord-tag').props;
    expect(tag.x + tag.width / 2).toBeCloseTo(237.8, 1);
    expect(tag.y + tag.height / 2).toBeCloseTo(32.8, 1);
  });

  it('the tag goes to the left for columns in the right half', () => {
    render(<GoBoard size={9} stones={empty9} width={328} interactive />);
    touch('responderGrant', 295.2, 32.8); // j9
    const tag = screen.getByTestId('board-coord-tag').props;
    expect(tag.x + tag.width / 2).toBeCloseTo(295.2 - 73.8, 1);
  });

  it('AC32: 5x5 (cell >= 44) draws neither crosshair nor tag', () => {
    render(<GoBoard size={5} stones={stonesFromSetup(5, {})} width={328} interactive />);
    touch('responderGrant', 164, 164);
    expect(screen.getByTestId('board-ghost')).toBeTruthy();
    expect(screen.queryByTestId('board-crosshair')).toBeNull();
    expect(screen.queryByTestId('board-coord-tag')).toBeNull();
  });
});

describe('last-move dot (AC33-AC34)', () => {
  const e5 = { x: 4, y: 4 } as Point;
  it('AC33: opposite-colored filled dot of radius 5.25', () => {
    const { rerender } = render(
      <GoBoard size={9} stones={stonesFromSetup(9, { B: ['e5'] })} width={328} lastMove={e5} />,
    );
    const dot = screen.getByTestId('board-last-move').props;
    expect(dot.cx).toBeCloseTo(164, 1);
    expect(dot.r).toBeCloseTo(5.25, 2);
    expect(dot.fill).toEqual(payload(stone.white));
    rerender(
      <GoBoard size={9} stones={stonesFromSetup(9, { W: ['e5'] })} width={328} lastMove={e5} />,
    );
    expect(screen.getByTestId('board-last-move').props.fill).toEqual(payload(stone.black));
  });

  it('AC33: none for null or an empty point', () => {
    const stones = stonesFromSetup(9, { B: ['e5'] });
    const { rerender } = render(<GoBoard size={9} stones={stones} width={328} lastMove={null} />);
    expect(screen.queryByTestId('board-last-move')).toBeNull();
    rerender(<GoBoard size={9} stones={stones} width={328} lastMove={{ x: 0, y: 0 }} />);
    expect(screen.queryByTestId('board-last-move')).toBeNull();
  });

  it('AC34: hidden when a marker sits on the last-move point', () => {
    const markers: Marker[] = [{ kind: 'circle', point: e5 }];
    render(
      <GoBoard
        size={9}
        stones={stonesFromSetup(9, { B: ['e5'] })}
        width={328}
        lastMove={e5}
        markers={markers}
      />,
    );
    expect(screen.queryByTestId('board-last-move')).toBeNull();
  });
});
