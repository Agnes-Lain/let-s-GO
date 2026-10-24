// QA M2 PR 3 — edge cases for sound triggers, capture fades, reduce motion, unmount, asset (AC35-AC41).
import { act, render, screen } from '@testing-library/react-native';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { AccessibilityInfo } from 'react-native';

import type { Point } from '@/engine';
import { parseVertex } from '@/engine';

import { GoBoard, type CaptureEvent, type GoBoardProps } from './GoBoard';
import { stonesFromSetup } from './geometry';
import * as soundModule from './sound';

jest.mock('./sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));
const playStoneSound = soundModule.playStoneSound as jest.Mock;

const at = (v: string): Point => parseVertex(v, 9);
const S = (b: string[], w: string[] = []) => stonesFromSetup(9, { B: b, W: w });
const cap = (id: number, points: string[]): CaptureEvent => ({
  id,
  color: 'W',
  points: points.map(at),
});
const ghosts = () => screen.queryAllByTestId(/^board-capture-/);

async function setup(props: Partial<GoBoardProps> = {}) {
  const base: GoBoardProps = {
    size: 9,
    stones: S(['e5']),
    width: 328,
    lastMove: at('e5'),
    ...props,
  };
  const view = await render(<GoBoard {...base} />);
  return {
    ...view,
    update: async (next: Partial<GoBoardProps>) => view.rerender(<GoBoard {...base} {...next} />),
  };
}
const reduceMotion = (v: boolean) =>
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(v);
const settle = async () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('sound triggers (edge)', () => {
  beforeEach(() => reduceMotion(true));

  it('a capturing move plays exactly one sound', async () => {
    const { update } = await setup({ stones: S(['e5'], ['c3']), lastMove: at('e5') });
    await settle();
    await update({
      stones: S(['e5', 'c2', 'b3', 'd3', 'c4']),
      lastMove: at('c4'),
      lastCapture: cap(1, ['c3']),
    });
    expect(playStoneSound).toHaveBeenCalledTimes(1);
  });

  it('rapid consecutive moves each play once, none lost', async () => {
    const { update } = await setup();
    await settle();
    await update({ stones: S(['e5', 'd4']), lastMove: at('d4') });
    await update({ stones: S(['e5', 'd4'], ['c3']), lastMove: at('c3') });
    await update({ stones: S(['e5', 'd4', 'g7'], ['c3']), lastMove: at('g7') });
    expect(playStoneSound).toHaveBeenCalledTimes(3);
  });

  it('toggling sound off then on does not play; the next stone does', async () => {
    const { update } = await setup();
    await settle();
    await update({ sound: false });
    await update({ sound: true });
    expect(playStoneSound).not.toHaveBeenCalled();
    await update({ stones: S(['e5', 'd4']), lastMove: at('d4') });
    expect(playStoneSound).toHaveBeenCalledTimes(1);
  });

  it('a stone arriving while sound is off is not replayed when sound turns on', async () => {
    const { update } = await setup({ sound: false });
    await settle();
    await update({ sound: false, stones: S(['e5', 'd4']), lastMove: at('d4') });
    await update({ sound: true, stones: S(['e5', 'd4']), lastMove: at('d4') });
    expect(playStoneSound).not.toHaveBeenCalled();
  });

  it('switching board size is silent', async () => {
    const { rerender } = await render(
      <GoBoard size={9} stones={S(['e5'])} width={328} lastMove={at('e5')} />,
    );
    await settle();
    await rerender(
      <GoBoard
        size={13}
        stones={stonesFromSetup(13, { B: ['g7'] })}
        width={328}
        lastMove={parseVertex('g7', 13)}
      />,
    );
    expect(playStoneSound).not.toHaveBeenCalled();
  });

  it('loading a scenario that replaces an empty board with stones + lastMove is the only (known) trigger', async () => {
    // Documents behaviour: a prop swap that looks like "a stone appeared" is a placement.
    const { update } = await setup({ stones: S([]), lastMove: null });
    await settle();
    await update({ stones: S(['e5']), lastMove: at('e5') });
    expect(playStoneSound).toHaveBeenCalledTimes(1);
  });
});

describe('capture fade (edge)', () => {
  it('fades every stone of a multi-stone capture, then removes all', async () => {
    reduceMotion(false);
    const { update } = await setup({ stones: S(['e5'], ['c3', 'c4', 'd3']), lastMove: at('e5') });
    await settle();
    await update({
      stones: S(['e5', 'b3']),
      lastMove: at('b3'),
      lastCapture: cap(1, ['c3', 'c4', 'd3']),
    });
    expect(
      ghosts()
        .map((g) => g.props.testID)
        .sort(),
    ).toEqual(['board-capture-c3', 'board-capture-c4', 'board-capture-d3']);
    await act(() => jest.advanceTimersByTime(350));
    expect(ghosts()).toHaveLength(0);
  });

  it('switching reduce motion on mid-fade still ends the fade cleanly', async () => {
    reduceMotion(false);
    let listener: (v: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((n: string, h: never) => {
      if (n === 'reduceMotionChanged') listener = h;
      return { remove: () => {} };
    }) as never);
    const { update } = await setup({ stones: S(['e5'], ['c3']), lastMove: at('e5') });
    await settle();
    await update({ stones: S(['e5', 'c4']), lastMove: at('c4'), lastCapture: cap(1, ['c3']) });
    await act(() => jest.advanceTimersByTime(100));
    await act(() => listener(true));
    await act(() => jest.advanceTimersByTime(400));
    expect(ghosts()).toHaveLength(0);
  });

  // KNOWN BUG (minor): undo while a capture fade is running leaves the ghost until it ends,
  // drawn over the restored stone. The dev screen passes lastCapture=null after undo.
  it('undo during a fade leaves no ghost captured stones', async () => {
    reduceMotion(false);
    const { update } = await setup({ stones: S(['e5'], ['c3']), lastMove: at('e5') });
    await settle();
    await update({ stones: S(['e5', 'c4']), lastMove: at('c4'), lastCapture: cap(1, ['c3']) });
    await act(() => jest.advanceTimersByTime(100));
    await update({ stones: S(['e5'], ['c3']), lastMove: at('e5'), lastCapture: null });
    expect(ghosts()).toHaveLength(0);
  });

  // KNOWN BUG (minor/major): undoing back to a move that had its own earlier capture (lower id)
  // is treated as a new capture and fades ghosts of stones that are not on the board.
  it('undo to an older capture id does not replay a fade', async () => {
    reduceMotion(false);
    const { update } = await setup({
      stones: S(['e5', 'c4'], ['g7']),
      lastMove: at('c4'),
      lastCapture: cap(4, ['c3']),
    });
    await settle();
    await update({ stones: S(['e5', 'c4'], ['g7', 'a1']), lastMove: at('a1'), lastCapture: null });
    await update({
      stones: S(['e5', 'c4'], ['g7']),
      lastMove: at('c4'),
      lastCapture: cap(4, ['c3']),
    });
    expect(ghosts()).toHaveLength(0);
  });
});

describe('unmount (leaks)', () => {
  it('unmounting mid placement and capture animation leaves no timers and no warnings', async () => {
    reduceMotion(false);
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { update, unmount } = await setup({ stones: S(['e5'], ['c3']), lastMove: at('e5') });
    await settle();
    await update({ stones: S(['e5', 'c4']), lastMove: at('c4'), lastCapture: cap(1, ['c3']) });
    await act(() => jest.advanceTimersByTime(50));
    await unmount();
    await act(() => jest.advanceTimersByTime(1000));
    // RNTL 14 / React 19 leave one faked queueMicrotask behind after any unmount (even a bare
    // <View />); run it so only the board's own timers are counted.
    jest.runAllTicks();
    expect(jest.getTimerCount()).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('sound asset (AC41)', () => {
  const dir = join(__dirname, '../../assets/sounds');
  it('stone.mp3 exists, is <= 30 KB and looks like MP3', () => {
    const size = statSync(join(dir, 'stone.mp3')).size;
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThanOrEqual(30 * 1024);
    const head = readFileSync(join(dir, 'stone.mp3')).subarray(0, 3);
    const ok = head.toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
    expect(ok).toBe(true);
  });
  it('LICENSE.md names a source and the CC0 license', () => {
    const text = readFileSync(join(dir, 'LICENSE.md'), 'utf8');
    expect(text).toMatch(/stone\.mp3/);
    expect(text).toMatch(/Source:/i);
    expect(text).toMatch(/CC0/);
  });
});

describe('fade continues across unrelated re-renders; ko undo/retake', () => {
  const before = () => S(['e5'], ['c3']);
  const after = () => S(['e5', 'c4']);

  it('highlights change, new-but-equal stones array and coordinates toggle keep the fade', async () => {
    reduceMotion(false);
    const { update } = await setup({ stones: before(), lastMove: at('e5') });
    await settle();
    await update({ stones: after(), lastMove: at('c4'), lastCapture: cap(1, ['c3']) });
    await act(() => jest.advanceTimersByTime(100));
    await update({
      stones: after(),
      lastMove: at('c4'),
      lastCapture: cap(1, ['c3']),
      highlights: [{ kind: 'hint', points: [at('g7')] }],
    });
    expect(ghosts()).toHaveLength(1);
    await update({
      stones: after(),
      lastMove: at('c4'),
      lastCapture: cap(1, ['c3']),
      showCoordinates: false,
    });
    expect(ghosts()).toHaveLength(1);
    await act(() => jest.advanceTimersByTime(250));
    expect(ghosts()).toHaveLength(0);
  });

  it('capture, undo, retake: one fade per real capture, none on undo', async () => {
    reduceMotion(false);
    const { update } = await setup({ stones: before(), lastMove: at('e5') });
    await settle();
    await update({ stones: after(), lastMove: at('c4'), lastCapture: cap(1, ['c3']) });
    expect(ghosts()).toHaveLength(1);
    await act(() => jest.advanceTimersByTime(400));
    await update({ stones: before(), lastMove: at('e5'), lastCapture: null }); // undo
    expect(ghosts()).toHaveLength(0);
    await update({ stones: after(), lastMove: at('c4'), lastCapture: cap(1, ['c3']) }); // retake, same id
    expect(ghosts()).toHaveLength(1);
    await act(() => jest.advanceTimersByTime(400));
    expect(ghosts()).toHaveLength(0);
  });
});
