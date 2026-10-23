// Danger rings and the atari line (spec docs/specs/M6-beginner-friendly.md §4.3, §4.6, §8).
// Facts come only from the engine's groups: a group is in atari 叫吃 jiàochī iff it has exactly
// one liberty 气 qì. No heuristic, no bot code. Pure: no React, no clock.
import type { CoachFact } from '@/coach';
import { groupAt, toVertex, type Color, type GameState, type Point } from '@/engine';

import type { Note } from './session';

export interface DangerGroup {
  color: Color;
  /** Sorted by column, then row (the engine's order). */
  stones: Point[];
  /** The single liberty left. */
  liberty: Point;
}

/** Points listed in the atari line before "…" (AC 33). */
export const ATARI_LINE_MAX_POINTS = 3;

function compareGroups(learner: Color) {
  return (a: DangerGroup, b: DangerGroup): number =>
    Number(b.color === learner) - Number(a.color === learner) ||
    b.stones.length - a.stones.length ||
    a.stones[0].x - b.stones[0].x ||
    a.stones[0].y - b.stones[0].y;
}

/**
 * Every group with exactly one liberty (AC 26): the learner's groups first, then more stones,
 * then the lower first-stone column, then row.
 */
export function dangerOf(game: GameState, learner: Color = 'B'): DangerGroup[] {
  const { size, cells } = game.board;
  const seen = new Set<number>();
  const out: DangerGroup[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === null || seen.has(i)) continue;
    const group = groupAt(game.board, { x: i % size, y: Math.floor(i / size) });
    if (!group) continue;
    for (const p of group.stones) seen.add(p.y * size + p.x);
    if (group.liberties.length === 1) {
      out.push({ color: group.color, stones: group.stones, liberty: group.liberties[0] });
    }
  }
  return out.sort(compareGroups(learner));
}

/** "D4" — the board label of a point (uppercase column letter, row from the bottom). */
function label(p: Point): string {
  return toVertex(p, 9).toUpperCase();
}

/** The feedback line of the first group and how many more groups are in atari (AC 33). */
export interface AtariLine {
  note: Note;
  more: number;
}

export function atariLine(groups: readonly DangerGroup[], learner: Color): AtariLine | null {
  if (groups.length === 0) return null;
  const [first] = groups;
  const own = first.color === learner;
  const one = first.stones.length === 1;
  const { key } = own
    ? one
      ? { key: 'game9.atari.you.one' }
      : { key: 'game9.atari.you.many' }
    : one
      ? { key: 'game9.atari.bot.one' }
      : { key: 'game9.atari.bot.many' };
  const listed = first.stones.slice(0, ATARI_LINE_MAX_POINTS).map(label);
  if (first.stones.length > ATARI_LINE_MAX_POINTS) listed.push('…');
  return {
    note: {
      key,
      params: { where: listed.join(', '), lib: label(first.liberty) },
    },
    more: groups.length - 1,
  };
}

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/**
 * The coaching dedupe (AC 44, §8): drops the facts that repeat the atari line — `exposed` and
 * `selfAtari` about a learner group in atari, and the bot's `atari` on such a group. Facts about
 * other groups, and captures, escapes and the learner's own ataris stay.
 */
export function withoutDangerFacts(
  facts: readonly CoachFact[],
  danger: readonly DangerGroup[],
  learner: Color,
): CoachFact[] {
  const own = danger.filter((g) => g.color === learner);
  if (own.length === 0) return [...facts];
  const inDanger = (p: Point) => own.some((g) => g.stones.some((s) => samePoint(s, p)));
  const isLiberty = (p: Point) => own.some((g) => samePoint(g.liberty, p));
  return facts.filter((f) => {
    switch (f.kind) {
      case 'exposed':
        return !(f.color === learner && inDanger(f.point));
      case 'selfAtari':
        return !(f.color === learner && (inDanger(f.point) || isLiberty(f.point)));
      case 'atari':
        return !(f.color !== learner && inDanger(f.point));
      default:
        return true;
    }
  });
}
