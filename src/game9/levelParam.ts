import type { BotLevel } from '@/bot';

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
