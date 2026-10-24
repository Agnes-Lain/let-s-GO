import type { BotLevel } from '@/bot';

import type { GameSize } from './config';
import { isHandicap, type Handicap } from './handicap';

/** The `level` route parameter; anything else plays Normal. */
export function parseLevel(value: string | undefined): BotLevel {
  return value === '1' || value === '3' ? (Number(value) as BotLevel) : 2;
}

/** The `handicap` route parameter (M6-beginner-friendly AC 14); anything else is an even game. */
export function parseHandicap(value: string | undefined): Handicap {
  if (value === undefined || !/^[0-9]$/.test(value)) return 0;
  const n = Number(value);
  return isHandicap(n) ? n : 0;
}

/** The `size` route parameter (M6b AC 5): "13" plays 13×13, anything else (or none) 9×9. */
export function parseSize(value: string | undefined): GameSize {
  return value === '13' ? 13 : 9;
}

/** The `confirm` route parameter (M6b AC 22): "1" turns "Confirm each move" on. */
export function parseConfirm(value: string | undefined): boolean {
  return value === '1';
}
