// Forced capture search (spec docs/specs/M5-sequence-v2.md §3.2–3.5, AC 1–7).
import { legalMoves, toVertex, type GameState } from '@/engine';

import { playAt, position } from './__fixtures__/board';
import {
  FORCED_CAPTURE_MAX_NODES,
  defenderReplies,
  forcedCapture,
  judgeAttack,
  winningMoves,
  type CaptureProblem,
} from './forcedCapture';

const problem = (maxMoves: number, target = 'c3'): CaptureProblem => ({
  attacker: 'B',
  target,
  maxMoves,
});

/** Plays `moves` alternately from `state` (the colour to move first is `state.toPlay`). */
function line(state: GameState, moves: string[]): GameState {
  return moves.reduce(playAt, state);
}

/** Every legal attacker point that the search accepts, as sorted vertices. */
function accepted(state: GameState, p: CaptureProblem): string[] {
  const size = state.board.size;
  const result = winningMoves(state, p, legalMoves(state));
  return result.moves.map((m) => toVertex(m.point, size)).sort();
}

/**
 * The 5×5 ladder of `ladder-play` (spec §7 L1), Black to play.
 *   5 . . . . .
 *   4 . . . . .
 *   3 . X O . .
 *   2 . . X X .
 *   1 . . . . .
 */
const LADDER5 = position(
  `
  5 . . . . .
  4 . . . . .
  3 . X O . .
  2 . . X X .
  1 . . . . .
  `,
  'B',
);

/** The far-edge ladder on 7×7 (u09 `find-breaker` without f5 and b6, ko spec §12b). */
const LADDER7 = position(
  `
  7 . . . . . . .
  6 . . . . . . .
  5 . . . . . . .
  4 . . . . . . .
  3 . X O . . . .
  2 . . X X . . .
  1 . . . . . . .
  `,
  'B',
);

describe('forcedCapture: the 5×5 ladder (AC 1–4, 27)', () => {
  it('AC 1: from the start only c4 wins in 4 moves', () => {
    const result = forcedCapture(LADDER5, problem(4));
    expect(result).toMatchObject({ forced: true, capped: false, moves: 4 });
    expect(accepted(LADDER5, problem(4))).toEqual(['c4']);
  });

  it('AC 1: d3 is an atari, but after W c4 the group has 3 liberties and escapes', () => {
    const j = judgeAttack(LADDER5, problem(4), 'd3');
    if (!j.ok) throw new Error('d3 must be legal');
    expect(j.forced).toBe(false);
    expect(j.reply.kind).toBe('play');
    if (j.reply.kind !== 'play') return;
    expect(toVertex(j.reply.point, 5)).toBe('c4');
    expect(j.reply.facts.playedGroup.liberties.map((p) => toVertex(p, 5)).sort()).toEqual([
      'b4',
      'c5',
      'd4',
    ]);
  });

  it('AC 2: after B c4 W d3, both ataris e3 and d4 win in the 3 moves left', () => {
    const s = line(LADDER5, ['c4', 'd3']);
    // §9b: the net (枷) e4 also wins in 3 (W d4 B d5 W e3 B e2, or W e3 B d4 W e2 B e1).
    expect(accepted(s, problem(3))).toEqual(['d4', 'e3', 'e4']);
  });

  it('§9b: the net e4 wins whichever liberty White extends to', () => {
    const s = line(LADDER5, ['c4', 'd3']);
    const j = judgeAttack(s, problem(3), 'e4');
    expect(j).toMatchObject({ ok: true, forced: true, moves: 3 });
    expect(accepted(line(s, ['e4', 'd4']), problem(2))).toEqual(['d5']);
    expect(accepted(line(s, ['e4', 'd4', 'd5', 'e3']), problem(1))).toEqual(['e2']);
    expect(accepted(line(s, ['e4', 'e3']), problem(2))).toEqual(['d4', 'e2']);
  });

  it('AC 3: after c4 d3 e3 d4 only d5 wins; e4 is too slow (W d5: 2 liberties, 1 move left)', () => {
    const s = line(LADDER5, ['c4', 'd3', 'e3', 'd4']);
    expect(accepted(s, problem(2))).toEqual(['d5']);
    const e4 = judgeAttack(s, problem(2), 'e4');
    if (!e4.ok || e4.reply.kind !== 'play') throw new Error('e4 must be legal with a reply');
    expect(e4.forced).toBe(false);
    expect(toVertex(e4.reply.point, 5)).toBe('d5');
    expect(e4.reply.facts.playedGroup.liberties.length).toBe(2);
  });

  it('AC 4: after c4 d3 d4 e3, both e4 and e2 win', () => {
    const s = line(LADDER5, ['c4', 'd3', 'd4', 'e3']);
    expect(accepted(s, problem(2))).toEqual(['e2', 'e4']);
  });

  it('AC 27: the last move of each branch is the only capture', () => {
    expect(accepted(line(LADDER5, ['c4', 'd3', 'e3', 'd4', 'd5', 'e4']), problem(1))).toEqual([
      'e5',
    ]);
    expect(accepted(line(LADDER5, ['c4', 'd3', 'd4', 'e3', 'e4', 'e2']), problem(1))).toEqual([
      'e1',
    ]);
    expect(accepted(line(LADDER5, ['c4', 'd3', 'd4', 'e3', 'e2', 'e4']), problem(1))).toEqual([
      'e5',
    ]);
  });

  it('a capturing move is solved at once, without a reply', () => {
    const s = line(LADDER5, ['c4', 'd3', 'e3', 'd4', 'd5', 'e4']);
    const j = judgeAttack(s, problem(1), 'e5');
    expect(j).toMatchObject({ ok: true, captured: true, forced: true, moves: 1 });
    if (j.ok) expect(j.reply.kind).toBe('none');
  });
});

describe('capture to escape and the pass rule (AC 5–6)', () => {
  // After c4 d3 e3 d4 e4 d5 (the detour), Black has 2 moves left of 5.
  //   5 . . . O .
  //   4 . . X O X
  //   3 . X O O X
  //   2 . . X X .
  //   1 . . . . .
  const DETOUR = line(LADDER5, ['c4', 'd3', 'e3', 'd4', 'e4', 'd5']);

  it('AC 5: B e5 is not winning: W e2 captures e3 e4 e5 and escapes', () => {
    const j = judgeAttack(DETOUR, problem(2), 'e5');
    if (!j.ok || j.reply.kind !== 'play') throw new Error('e5 must be legal with a reply');
    expect(j.forced).toBe(false);
    expect(toVertex(j.reply.point, 5)).toBe('e2');
    expect(j.reply.facts.captured.flat().length).toBe(3);
  });

  it('AC 5: after B e5 the defender may extend at c5 or capture at e2', () => {
    const s = playAt(DETOUR, 'e5');
    const replies = defenderReplies(s, 'c3').map((p) => toVertex(p, 5));
    expect(replies.sort()).toEqual(['c5', 'e2']);
  });

  it('AC 5/6: B c5 is winning: the only liberty e5 is suicide, White passes, B e5 captures', () => {
    const s = playAt(DETOUR, 'c5');
    expect(defenderReplies(s, 'c3')).toEqual([]);
    const j = judgeAttack(DETOUR, problem(2), 'c5');
    expect(j).toMatchObject({ ok: true, forced: true, moves: 2 });
    if (j.ok) expect(j.reply.kind).toBe('pass');
  });

  it('AC 6: two equal replies: the lowest column is shown, then the lowest row', () => {
    // B b3 makes W c3 run: c4 and d3 both give 4 liberties.
    const lone = position(
      `
      5 . . . . .
      4 . . . . .
      3 . . O . .
      2 . . X . .
      1 . . . . .
      `,
      'B',
    );
    const j = judgeAttack(lone, problem(1), 'b3');
    if (!j.ok || j.reply.kind !== 'play') throw new Error('b3 must be legal with a reply');
    expect(toVertex(j.reply.point, 5)).toBe('c4');

    // Same column: c4 and c2 are equal, the lower row c2 is shown.
    const column = position(
      `
      5 . . . . .
      4 . . . . .
      3 . X O . .
      2 . . . . .
      1 . . . . .
      `,
      'B',
    );
    const k = judgeAttack(column, problem(1), 'd3');
    if (!k.ok || k.reply.kind !== 'play') throw new Error('d3 must be legal with a reply');
    expect(toVertex(k.reply.point, 5)).toBe('c2');
  });

  it('AC 6: the same position reached in another order gives the same answer', () => {
    const a = line(LADDER5, ['c4', 'd3', 'd4', 'e3']);
    const b = position(
      `
      5 . . . . .
      4 . . X X .
      3 . X O O O
      2 . . X X .
      1 . . . . .
      `,
      'B',
    );
    expect(a.board.cells).toEqual(b.board.cells);
    const summary = (s: GameState) => {
      const j = judgeAttack(s, problem(2), 'a1');
      if (!j.ok) throw new Error('a1 must be legal');
      return {
        forced: j.forced,
        moves: j.moves,
        reply: j.reply.kind === 'play' ? j.reply.point : null,
      };
    };
    expect(summary(a)).toEqual(summary(b));
    expect(summary(b)).toEqual(summary(b));
    expect(summary(a)).toMatchObject({ forced: false, moves: null });
  });

  it('the longest resistance is shown when every reply loses', () => {
    // After B c4 W d3 B d4, White's only reply e3 is shown (one candidate).
    const s = line(LADDER5, ['c4', 'd3']);
    const j = judgeAttack(s, problem(3), 'd4');
    if (!j.ok || j.reply.kind !== 'play') throw new Error('d4 must be legal');
    expect(j.forced).toBe(true);
    expect(j.moves).toBe(3);
    expect(toVertex(j.reply.point, 5)).toBe('e3');
  });
});

describe('the 7×7 far-edge ladder and the node cap (AC 7)', () => {
  it('captures in 8 moves within the node cap', () => {
    const result = forcedCapture(LADDER7, problem(8));
    expect(result).toMatchObject({ forced: true, capped: false, moves: 8 });
    expect(result.nodes).toBeLessThanOrEqual(FORCED_CAPTURE_MAX_NODES);
  });

  it('is not forced in 7 moves', () => {
    expect(forcedCapture(LADDER7, problem(7))).toMatchObject({ forced: false, capped: false });
  });

  it('a cap of 50 nodes stops the search: capped, not forced, no throw', () => {
    const result = forcedCapture(LADDER7, { ...problem(8), maxNodes: 50 });
    expect(result).toMatchObject({ forced: false, capped: true, moves: null });
    expect(result.nodes).toBeLessThanOrEqual(51);
  });

  it('judgeAttack and winningMoves report the cap too', () => {
    const j = judgeAttack(LADDER7, { ...problem(8), maxNodes: 20 }, 'c4');
    expect(j).toMatchObject({ ok: true, forced: false, capped: true });
    expect(winningMoves(LADDER7, { ...problem(8), maxNodes: 20 })).toMatchObject({
      moves: [],
      capped: true,
    });
  });

  it('c4 is among the winning first moves on 7×7', () => {
    expect(accepted(LADDER7, problem(8))).toContain('c4');
    expect(accepted(LADDER7, problem(8))).not.toContain('d3');
  });
});

describe('edge cases', () => {
  it('an illegal attacker move is reported, never thrown', () => {
    expect(judgeAttack(LADDER5, problem(4), 'c3')).toEqual({ ok: false, reason: 'occupied' });
  });

  it('a target that is not on the board is never forced', () => {
    expect(forcedCapture(LADDER5, problem(4, 'a5'))).toMatchObject({ forced: false, moves: null });
  });

  it('winningMoves without candidates uses the liberties, ordered by fewest moves then column', () => {
    const s = line(LADDER5, ['c4', 'd3', 'd4', 'e3']);
    const result = winningMoves(s, problem(2));
    expect(result.moves.map((m) => [toVertex(m.point, 5), m.moves])).toEqual([
      ['e2', 2],
      ['e4', 2],
    ]);
  });

  it('the search does not change its input', () => {
    const before = JSON.stringify(LADDER7);
    forcedCapture(LADDER7, problem(8));
    expect(JSON.stringify(LADDER7)).toBe(before);
  });
});
