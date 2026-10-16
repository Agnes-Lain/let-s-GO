// Stars per lesson (spec §5.2). The thresholds live here so the product owner can tune them.
import type { Outcome } from './schema';

/** Fractions of the set: 3★ first-try, 2★ solved in the end, 1★ solved in the end. */
export const STAR_RULES = { threeClean: 0.8, twoSolved: 0.8, oneSolved: 0.5 } as const;

export type Stars = 0 | 1 | 2 | 3;

/** `count / total >= fraction`, compared in integers (avoids float error for 0.8 and 0.5). */
function atLeast(count: number, total: number, fraction: number): boolean {
  return count * 100 >= total * Math.round(fraction * 100);
}

/** clean = first try without hint; solved = clean + solved later; total = set size. */
export function countOutcomes(outcomes: readonly Outcome[]): {
  clean: number;
  solved: number;
  total: number;
} {
  const clean = outcomes.filter((o) => o === 'clean').length;
  const solved = clean + outcomes.filter((o) => o === 'solved').length;
  return { clean, solved, total: outcomes.length };
}

/** 0–3 stars for one run of a practice set. An empty set gives 0★. Order does not matter. */
export function computeStars(outcomes: readonly Outcome[]): Stars {
  const { clean, solved, total } = countOutcomes(outcomes);
  if (total === 0) return 0;
  if (atLeast(clean, total, STAR_RULES.threeClean)) return 3;
  if (atLeast(solved, total, STAR_RULES.twoSolved)) return 2;
  if (atLeast(solved, total, STAR_RULES.oneSolved)) return 1;
  return 0;
}
