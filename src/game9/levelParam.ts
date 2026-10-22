import type { BotLevel } from '@/bot';

/** The `level` route parameter; anything else plays Normal. */
export function parseLevel(value: string | undefined): BotLevel {
  return value === '1' || value === '3' ? (Number(value) as BotLevel) : 2;
}
