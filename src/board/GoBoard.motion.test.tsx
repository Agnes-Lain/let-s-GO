// M2 PR 3 — placement/capture animation, reduced motion, stone sound (AC35-AC41).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, processColor } from 'react-native';

import type { Point } from '@/engine';
import { parseVertex } from '@/engine';
import { stone } from '@/theme/tokens';

import { GoBoard, type CaptureEvent, type GoBoardProps } from './GoBoard';
import { boardGeometry, pointToLocation, stonesFromSetup } from './geometry';
import * as soundModule from './sound';

jest.mock('./sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));
const playStoneSound = soundModule.playStoneSound as jest.Mock;

const at = (v: string): Point => parseVertex(v, 9);
const e5 = stonesFromSetup(9, { B: ['e5'] });
const e5d4 = stonesFromSetup(9, { B: ['e5', 'd4'] });
const withC3 = stonesFromSetup(9, { B: ['e5'], W: ['c3'] });
const capturedC3 = stonesFromSetup(9, { B: ['e5', 'c2', 'b3', 'd3', 'c4'] });
const payload = (c: string) => ({ type: 0, payload: processColor(c) });

function setup(props: Partial<GoBoardProps> = {}) {
  const base: GoBoardProps = { size: 9, stones: e5, width: 328, lastMove: at('e5'), ...props };
  const view = render(<GoBoard {...base} />);
  return {
    ...view,
    update: (next: Partial<GoBoardProps>) => view.rerender(<GoBoard {...base} {...next} />),
  };
}

function reduceMotion(value: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(value);
}
const settle = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('stone sound (AC35-AC37)', () => {
  beforeEach(() => reduceMotion(true));

  it('AC35: silent on mount, once for a new stone, not for highlights-only changes', async () => {
    const { update } = setup();
    await settle();
    expect(playStoneSound).not.toHaveBeenCalled();
    update({ stones: e5d4, lastMove: at('d4') });
    expect(playStoneSound).toHaveBeenCalledTimes(1);
    update({
      stones: e5d4,
      lastMove: at('d4'),
      highlights: [{ kind: 'hint', points: [at('c3')] }],
    });
    expect(playStoneSound).toHaveBeenCalledTimes(1);
  });

  it('AC36: silent with sound={false}', async () => {
    const { update } = setup({ sound: false });
    await settle();
    update({ stones: e5d4, lastMove: at('d4') });
    expect(playStoneSound).not.toHaveBeenCalled();
  });

  it('AC36: silent on an illegal touch-up', async () => {
    const onIllegal = jest.fn();
    setup({ interactive: true, onIllegal });
    await settle();
    const p = pointToLocation(boardGeometry(9, 328, true), at('e5'));
    const nativeEvent = { locationX: p.x, locationY: p.y };
    fireEvent(screen.getByTestId('board-touch'), 'responderGrant', { nativeEvent });
    fireEvent(screen.getByTestId('board-touch'), 'responderRelease', { nativeEvent });
    expect(onIllegal).toHaveBeenCalledWith(at('e5'), 'occupied');
    expect(playStoneSound).not.toHaveBeenCalled();
  });

  it('AC37: silent on undo, reset and when sound is toggled on', async () => {
    const { update } = setup({ stones: e5d4, lastMove: at('d4') });
    await settle();
    update({ stones: e5, lastMove: at('e5') }); // undo
    update({ stones: stonesFromSetup(9, {}), lastMove: null }); // reset
    update({ stones: stonesFromSetup(9, {}), lastMove: null, sound: true });
    expect(playStoneSound).not.toHaveBeenCalled();
  });
});

describe('placement animation (AC37, AC39)', () => {
  it('runs a 120 ms ease-out timing for a new stone with reduce motion off', async () => {
    reduceMotion(false);
    const timing = jest.spyOn(Animated, 'timing');
    const { update } = setup();
    await settle();
    expect(timing).not.toHaveBeenCalled();
    update({ stones: e5d4, lastMove: at('d4') });
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 1, duration: 120 });
    act(() => jest.advanceTimersByTime(200));
    expect(screen.getByTestId('board-stone-d4')).toBeTruthy();
  });

  it('AC37: undo runs no placement animation', async () => {
    reduceMotion(false);
    const { update } = setup({ stones: e5d4, lastMove: at('d4') });
    await settle();
    const timing = jest.spyOn(Animated, 'timing');
    update({ stones: e5, lastMove: at('e5') });
    expect(timing).not.toHaveBeenCalled();
  });

  it('AC39: reduce motion on -> no placement animation', async () => {
    reduceMotion(true);
    const { update } = setup();
    await settle();
    const timing = jest.spyOn(Animated, 'timing');
    update({ stones: e5d4, lastMove: at('d4') });
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByTestId('board-stone-d4')).toBeTruthy();
  });
});

describe('capture fade-out (AC38-AC40)', () => {
  const capture = (id: number, points: string[] = ['c3']): CaptureEvent => ({
    id,
    color: 'W',
    points: points.map(at),
  });

  it('AC38: captured stone is drawn at once, gone after 300 ms, same id never replays', async () => {
    reduceMotion(false);
    const { update } = setup({ stones: withC3, lastMove: at('c4') });
    await settle();
    update({ stones: capturedC3, lastMove: at('c4'), lastCapture: capture(1) });
    const ghost = screen.getByTestId('board-capture-c3');
    expect(ghost.props.fill).toEqual(payload(stone.white));
    act(() => jest.advanceTimersByTime(150));
    expect(screen.queryByTestId('board-capture-c3')).toBeTruthy();
    act(() => jest.advanceTimersByTime(200));
    expect(screen.queryByTestId('board-capture-c3')).toBeNull();
    update({ stones: capturedC3, lastMove: at('c4'), lastCapture: capture(1) });
    expect(screen.queryAllByTestId(/^board-capture-/)).toHaveLength(0);
  });

  it('AC38: a new id ends the previous animation at once', async () => {
    reduceMotion(false);
    const { update } = setup({ stones: withC3, lastMove: at('c4') });
    await settle();
    update({ stones: capturedC3, lastMove: at('c4'), lastCapture: capture(1) });
    act(() => jest.advanceTimersByTime(100));
    // A real second capture arrives together with a new stone.
    update({
      stones: stonesFromSetup(9, { B: ['e5', 'c2', 'b3', 'd3', 'c4', 'h7'] }),
      lastMove: at('h7'),
      lastCapture: capture(2, ['g7']),
    });
    expect(screen.queryByTestId('board-capture-c3')).toBeNull();
    expect(screen.getByTestId('board-capture-g7')).toBeTruthy();
  });

  it('does not animate a capture that is already present on mount', async () => {
    reduceMotion(false);
    setup({ stones: capturedC3, lastMove: at('c4'), lastCapture: capture(1) });
    await settle();
    expect(screen.queryAllByTestId(/^board-capture-/)).toHaveLength(0);
  });

  it('AC39: reduce motion on -> no board-capture-* ever', async () => {
    reduceMotion(true);
    const { update } = setup({ stones: withC3, lastMove: at('c4') });
    await settle();
    update({ stones: capturedC3, lastMove: at('c4'), lastCapture: capture(1) });
    expect(screen.queryAllByTestId(/^board-capture-/)).toHaveLength(0);
    act(() => jest.advanceTimersByTime(400));
    expect(screen.queryAllByTestId(/^board-capture-/)).toHaveLength(0);
  });

  it('AC40: reduceMotionChanged(true) while mounted applies to the next capture', async () => {
    reduceMotion(false);
    let listener: (value: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      name: string,
      handler: (value: boolean) => void,
    ) => {
      if (name === 'reduceMotionChanged') listener = handler;
      return { remove: () => {} };
    }) as never);
    const { update } = setup({ stones: withC3, lastMove: at('c4') });
    await settle();
    act(() => listener(true));
    update({ stones: capturedC3, lastMove: at('c4'), lastCapture: capture(1) });
    expect(screen.queryAllByTestId(/^board-capture-/)).toHaveLength(0);
  });
});
