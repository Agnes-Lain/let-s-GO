// Numbers in 9×9 game copy (spec M6 §9): French writes decimals with a comma ("5,5").
import type { Note } from './session';

export function formatNumber(n: number, language: string): string {
  const text = String(n);
  return language.startsWith('fr') ? text.replace('.', ',') : text;
}

/**
 * A note's params with every decimal number formatted for the language. Integers stay numbers:
 * i18next picks the `_one/_other` plural only for a numeric `count` (M6-game-coaching QA).
 */
export function formatParams(
  note: Note,
  language: string,
): Record<string, string | number> | undefined {
  if (!note.params) return undefined;
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(note.params)) {
    out[key] =
      typeof value === 'number' && !Number.isInteger(value) ? formatNumber(value, language) : value;
  }
  return out;
}
