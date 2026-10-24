// Test driver for the practice screen on the sample lesson (used by __tests__/app/practice*.tsx).
// Tests that open the sample mock the registry with `registryWithSample()` (sampleRegistry.ts).
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router as appRouter } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import en from '@/i18n/en.json';
import { SAMPLE_TEXTS } from '@/lessons/__fixtures__/sampleRegistry';

export const texts = { ...en, ...SAMPLE_TEXTS.en } as Record<string, string>;
export const hidden = { includeHiddenElements: true };
export const settle = () => act(async () => {});
export const advance = (ms: number) => act(async () => jest.advanceTimersByTime(ms));

export function reduceMotion(value: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(value);
}

export async function open(url = '/practice/u00-sample') {
  const router = await renderRouter('./app', { initialUrl: '/learn' });
  await settle();
  await act(() => appRouter.push(url));
  await settle();
  return router;
}

export function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(5).filter(Boolean));
}

/** Touch-down + touch-up on a vertex of the practice board. */
export async function tap(vertex: string) {
  const board = screen.getByTestId('practice-board');
  const width = flat(board.props.style).width as number;
  const size = Math.round(Math.sqrt(boardSize()));
  const g = boardGeometry(size as 5 | 7 | 9, width, false);
  const { x, y } = pointToLocation(g, parseVertex(vertex, size as 5 | 7 | 9));
  const target = screen.getByTestId('board-touch');
  const event = { nativeEvent: { locationX: x, locationY: y } };
  await act(async () => {
    fireEvent(target, 'responderGrant', event);
  });
  await act(async () => {
    fireEvent(target, 'responderRelease', event);
  });
}

/** Number of points of the current board (from the grid lines). */
export function boardSize(): number {
  const lines = screen.queryAllByTestId(/^board-grid-h-/, hidden).length;
  return lines * lines;
}

export const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
export const feedbackText = () =>
  String(flat(screen.getByTestId('practice-feedback').props).accessibilityLabel ?? '');
export const has = (testID: string) => screen.queryAllByTestId(testID, hidden).length > 0;

/** Answers the current sample exercise correctly. */
export async function solve(index: number) {
  switch (index) {
    case 0:
      return tap('c4');
    case 1:
      await tap('b1');
      await tap('d1');
      await tap('c2');
      return press('practice-check');
    case 2:
      return tap('d3');
    case 3:
      return tap('c3');
    case 4:
      return press('practice-option-2');
    case 5:
      await press('practice-chip-5');
      return press('practice-check');
  }
}

export async function next() {
  if (screen.queryByTestId('practice-next')) await press('practice-next');
  else await press('practice-finish');
  await settle();
}

/** Goes to exercise `index` (0-based) by solving the earlier ones cleanly. */
export async function goTo(index: number) {
  for (let i = 0; i < index; i++) {
    await solve(i);
    await next();
  }
}
