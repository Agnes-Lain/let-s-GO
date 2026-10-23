// Move facts and the one-line note (spec docs/specs/M6-game-coaching.md §4.1–4.2). The engine
// computes the facts; the note is an i18n key with parameters. Pure: no React, clock or randomness.
import {
  groupAt,
  toVertex,
  type BoardSize,
  type Color,
  type GameState,
  type Group,
  type Move,
  type MoveFacts,
  type Point,
} from '@/engine';

export type CoachFactKind = 'capture' | 'selfAtari' | 'exposed' | 'atari' | 'escape';

/**
 * One fact about a move. `color` is the mover, except for `exposed`: there it is the owner of the
 * group left with one liberty (the opponent of the mover).
 */
export interface CoachFact {
  kind: CoachFactKind;
  color: Color;
  point: Point;
  /** Stones in the group (selfAtari, exposed, atari, escape). */
  size?: number;
  /** Stones captured (capture). */
  count?: number;
}

/** One sentence: an i18n key and its parameters (same shape as the game's `Note`). */
export interface CoachNote {
  key: string;
  params?: Record<string, string | number>;
}

/** Priority of a note, high to low (§4.2). */
export const NOTE_PRIORITY: readonly CoachFactKind[] = [
  'capture',
  'selfAtari',
  'exposed',
  'atari',
  'escape',
];

function other(color: Color): Color {
  return color === 'B' ? 'W' : 'B';
}

/** Points sorted by column, then row (the engine's order). */
function firstPoint(points: readonly Point[]): Point {
  return [...points].sort((a, b) => a.x - b.x || a.y - b.y)[0];
}

/** The biggest group of a list (the first one on a tie). */
function largest(groups: readonly Group[]): Group {
  return groups.reduce((best, g) => (g.stones.length > best.stones.length ? g : best));
}

function neighbours(p: Point, size: number): Point[] {
  return [
    { x: p.x - 1, y: p.y },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y - 1 },
    { x: p.x, y: p.y + 1 },
  ].filter((q) => q.x >= 0 && q.y >= 0 && q.x < size && q.y < size);
}

/**
 * The facts of one move (§4.1), from the positions before and after it and the engine's
 * MoveFacts. A pass has no facts.
 */
export function moveNote(
  before: GameState,
  move: Move,
  _after: GameState,
  facts: MoveFacts | null,
): CoachFact[] {
  if (move.type === 'pass' || !facts) return [];
  const mover = move.color;
  const out: CoachFact[] = [];
  const played = facts.playedGroup;

  const captured = facts.captured.flat();
  if (captured.length > 0) {
    out.push({
      kind: 'capture',
      color: mover,
      point: firstPoint(captured),
      count: captured.length,
    });
  }

  if (facts.selfAtari) {
    out.push({ kind: 'selfAtari', color: mover, point: move.point, size: played.stones.length });
  }

  if (facts.opponentAtari.length > 0) {
    const group = largest(facts.opponentAtari);
    out.push({ kind: 'atari', color: mover, point: group.stones[0], size: group.stones.length });
    // The same groups seen by their owner: left with one liberty, after ≥ 2 before the move.
    const newlyExposed = facts.opponentAtari.filter(
      (g) => (groupAt(before.board, g.stones[0])?.liberties.length ?? 0) >= 2,
    );
    if (newlyExposed.length > 0) {
      const weak = largest(newlyExposed);
      out.push({
        kind: 'exposed',
        color: other(mover),
        point: weak.stones[0],
        size: weak.stones.length,
      });
    }
  }

  const rescued = neighbours(move.point, before.board.size).some((q) => {
    const group = groupAt(before.board, q);
    return group !== null && group.color === mover && group.liberties.length === 1;
  });
  // The played stone joins every touching own group, so the rescued group is the played group.
  if (rescued && played.liberties.length >= 2) {
    out.push({ kind: 'escape', color: mover, point: move.point, size: played.stones.length });
  }

  return out;
}

/** Parameters of a fact's sentence: `count` (plurals) and `point` (e.g. "e4"). */
export function factParams(fact: CoachFact, size: BoardSize = 9): Record<string, string | number> {
  if (fact.kind === 'capture') return { count: fact.count ?? 0 };
  return { count: fact.size ?? 1, point: toVertex(fact.point, size).toUpperCase() };
}

/**
 * The single highest-priority fact that matters to the learner (§4.2), or null. An `exposed`
 * fact counts only for the learner's own groups: the bot's group left in atari by the learner is
 * already the `atari` fact of that move.
 */
export function pickFact(facts: readonly CoachFact[], learner: Color): CoachFact | null {
  const relevant = facts.filter((f) => f.kind !== 'exposed' || f.color === learner);
  for (const kind of NOTE_PRIORITY) {
    const fact = relevant.find((f) => f.kind === kind);
    if (fact) return fact;
  }
  return null;
}

/** The note of a fact of the learner's own move (`exposed` never applies to it). */
function youNote(fact: CoachFact): CoachNote | null {
  const params = factParams(fact);
  switch (fact.kind) {
    case 'capture':
      return { key: 'coach.you.capture', params };
    case 'selfAtari':
      return { key: 'coach.you.selfAtari', params };
    case 'atari':
      return { key: 'coach.you.atari', params };
    case 'escape':
      return { key: 'coach.you.escape' };
    case 'exposed':
      return null;
  }
}

/** The note of a fact of the bot's move. */
function botNote(fact: CoachFact): CoachNote {
  const params = factParams(fact);
  switch (fact.kind) {
    case 'capture':
      return { key: 'coach.bot.capture', params };
    case 'selfAtari':
      return { key: 'coach.bot.selfAtari', params };
    case 'exposed':
      return { key: 'coach.you.exposed', params };
    case 'atari':
      return { key: 'coach.bot.atari', params };
    case 'escape':
      return { key: 'coach.bot.escape' };
  }
}

/**
 * One note line for a ply (§4.2): the highest-priority fact, worded for the learner. `mover` is
 * the colour that played the move.
 */
export function pickNote(
  facts: readonly CoachFact[],
  learner: Color,
  mover: Color,
): CoachNote | null {
  const fact = pickFact(facts, learner);
  if (!fact) return null;
  return mover === learner ? youNote(fact) : botNote(fact);
}
