// The Settings switches on the board (docs/specs/M6-settings-onboarding-a11y.md AC 9, 11, 13).
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { createAudioPlayer } from 'expo-audio';
import { AccessibilityInfo, Animated } from 'react-native';

import type { Point } from '@/engine';
import { parseVertex } from '@/engine';
import { settingsStore } from '@/store';

import { GoBoard, type CaptureEvent, type GoBoardProps } from './GoBoard';
import { stonesFromSetup } from './geometry';
import { resetStoneSoundForTests, setSoundEnabled } from './sound';
import { useReduceMotion } from './useReduceMotion';

const mockPlayer = (createAudioPlayer as jest.Mock)() as { play: jest.Mock; seekTo: jest.Mock };

const at = (v: string): Point => parseVertex(v, 9);
const e5 = stonesFromSetup(9, { B: ['e5'] });
const e5d4 = stonesFromSetup(9, { B: ['e5', 'd4'] });
const withC3 = stonesFromSetup(9, { B: ['e5'], W: ['c3'] });
const capturedC3 = stonesFromSetup(9, { B: ['e5', 'c2', 'b3', 'd3', 'c4'] });
const capture: CaptureEvent = { id: 1, color: 'W', points: [at('c3')] };

async function setup(props: Partial<GoBoardProps> = {}) {
  const base: GoBoardProps = { size: 9, stones: e5, width: 328, lastMove: at('e5'), ...props };
  const view = await render(<GoBoard {...base} />);
  return {
    update: async (next: Partial<GoBoardProps>) => view.rerender(<GoBoard {...base} {...next} />),
  };
}

function osReduceMotion(value: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(value);
}
const settle = async () => act(async () => {});
const flush = async () => act(async () => new Promise((r) => setTimeout(r, 0)));

beforeEach(async () => {
  jest.clearAllMocks();
  mockPlayer.seekTo.mockImplementation(() => Promise.resolve());
  resetStoneSoundForTests();
  await act(() => settingsStore.getState().setReduceMotion(false));
});
afterEach(async () => {
  jest.restoreAllMocks();
  await act(() => settingsStore.getState().setReduceMotion(false));
});

describe('AC 9: the Stone sound switch gates the player', () => {
  it('sound off: a placed stone on <GoBoard sound> never calls the player', async () => {
    osReduceMotion(true);
    setSoundEnabled(false);
    const { update } = await setup({ sound: true });
    await settle();
    await update({ stones: e5d4, lastMove: at('d4') });
    await flush();
    expect(createAudioPlayer).not.toHaveBeenCalled();
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('sound on: once per placed stone', async () => {
    osReduceMotion(true);
    setSoundEnabled(true);
    const { update } = await setup({ sound: true });
    await settle();
    await update({ stones: e5d4, lastMove: at('d4') });
    await flush();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });
});

describe('AC 11: useReduceMotion = OS OR app switch', () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])('OS %s, app %s → %s', async (os, app, expected) => {
    osReduceMotion(os);
    await act(() => settingsStore.getState().setReduceMotion(app));
    const { result } = await renderHook(() => useReduceMotion());
    await settle();
    expect(result.current).toBe(expected);
  });

  it('true before the OS answers, even with the app switch off', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(new Promise<boolean>(() => {}));
    const { result } = await renderHook(() => useReduceMotion());
    expect(result.current).toBe(true);
  });
});

describe('AC 13: the app switch on (OS off) removes the board motion', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('no 120 ms placement timing', async () => {
    osReduceMotion(false);
    await act(() => settingsStore.getState().setReduceMotion(true));
    const { update } = await setup();
    await settle();
    const timing = jest.spyOn(Animated, 'timing');
    await update({ stones: e5d4, lastMove: at('d4') });
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByTestId('board-stone-d4')).toBeTruthy();
  });

  it('no 300 ms capture fade', async () => {
    osReduceMotion(false);
    await act(() => settingsStore.getState().setReduceMotion(true));
    const { update } = await setup({ stones: withC3, lastMove: at('c4') });
    await settle();
    await update({ stones: capturedC3, lastMove: at('c4'), lastCapture: capture });
    expect(screen.queryAllByTestId(/^board-capture-/)).toHaveLength(0);
  });

  it('control: with both off the placement animates', async () => {
    osReduceMotion(false);
    const { update } = await setup();
    await settle();
    const timing = jest.spyOn(Animated, 'timing');
    await update({ stones: e5d4, lastMove: at('d4') });
    expect(timing).toHaveBeenCalledTimes(1);
  });
});
