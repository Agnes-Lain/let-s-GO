import { useWindowDimensions } from 'react-native';

import { spacing } from '@/theme/tokens';

/** Boards never grow past this (tablets, wide web windows). */
export const MAX_BOARD_WIDTH = 480;

/** The square board fills the width between the 16 px gutters (328 px on a 360 px phone). */
export function boardWidthFor(windowWidth: number): number {
  return Math.max(0, Math.min(windowWidth - 2 * spacing.lg, MAX_BOARD_WIDTH));
}

export function useBoardWidth(): number {
  return boardWidthFor(useWindowDimensions().width);
}
