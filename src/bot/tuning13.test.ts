// Spec docs/specs/M6b-13x13-bot-tuning.md §4.3 (AC 5, 11, 14): the 13×13 knobs live in their own
// `_13` constants and are selected by board size; the 9×9 values stay as they were.
import { createGame } from '@/engine';

import {
  MC_PLAYOUTS_PER_CANDIDATE_13,
  MC_TEMPERATURE,
  MC_TEMPERATURE_13,
  OPENING_MOVES,
  OPENING_MOVES_13,
  SETTLED_REGION_MAX,
  SETTLED_REGION_MAX_13,
  createRng,
  level3Search,
  mcBudget,
  mcTemperature,
  openingMoves,
  settledOwners,
  settledRegionMax,
  softmaxPick,
  type CandidateValue,
} from './index';
import { position } from './__fixtures__/board';

describe('AC 5: the 9×9 values are unchanged', () => {
  it('opening 30 moves, settled region ≤ 12, temperature 0.21, 1 200 / 110 playouts', () => {
    expect(OPENING_MOVES).toBe(30);
    expect(SETTLED_REGION_MAX).toBe(12);
    expect(MC_TEMPERATURE).toBe(0.21);
    expect(openingMoves(9)).toBe(30);
    expect(settledRegionMax(9)).toBe(12);
    expect(mcTemperature(9)).toBe(0.21);
    expect(mcBudget(9)).toEqual({ candidates: 12, perCandidate: 100, maxPlies: 110 });
  });
});

describe('AC 11: the tuned 13×13 values, selected by size', () => {
  it('opening 50 moves, settled region ≤ 25, temperature 0.06, 50 playouts per candidate', () => {
    expect(OPENING_MOVES_13).toBe(50);
    expect(SETTLED_REGION_MAX_13).toBe(25);
    expect(MC_TEMPERATURE_13).toBe(0.06);
    expect(MC_PLAYOUTS_PER_CANDIDATE_13).toBe(50);
    expect(openingMoves(13)).toBe(OPENING_MOVES_13);
    expect(settledRegionMax(13)).toBe(SETTLED_REGION_MAX_13);
    expect(mcTemperature(13)).toBe(MC_TEMPERATURE_13);
  });

  it('AC 14: strength comes from a lower temperature, not from more playouts', () => {
    expect(MC_TEMPERATURE_13).toBeLessThan(MC_TEMPERATURE);
    expect(mcBudget(13).perCandidate * mcBudget(13).candidates).toBeLessThanOrEqual(600);
  });
});

describe('settledOwners by size', () => {
  // A 16-point empty corner (a10–d13) bordered by Black only.
  const BOARD = position(
    `
    13 . . . . X . . . . . . . .
    12 . . . . X . . . . . . . .
    11 . . . . X . . . . . . . .
    10 . . . . X . . . . . . . .
     9 X X X X X . . . . . . . .
     8 . . . . . . . . . . . . .
     7 . . . . . . . . . . . . .
     6 . . . . . . . . . . . . .
     5 . . . . . . . . . . . . .
     4 . . . . . . . . . . . . .
     3 . . . . . . . . . . . . .
     2 . . . . . . . . . . . . .
     1 . . . . . . . . . . . . .
    `,
    'W',
  );
  const corner = 12 * 13; // a13

  it('a 16-point corner is settled on 13×13 by default, not with the 9×9 limit', () => {
    expect(settledOwners(BOARD.board)[corner]).toBe('B');
    expect(settledOwners(BOARD.board, SETTLED_REGION_MAX)[corner]).toBeNull();
  });
});

describe('level 3 tuning overrides (AC 10)', () => {
  it('perCandidate and temperature overrides change only the search budget and pick', () => {
    const state = createGame(13, { komi: 6.5 });
    const search = level3Search(state, 3, { perCandidate: 10 });
    for (const c of search.candidates) expect(c.playouts).toBe(10);
    expect(level3Search(state, 3, { perCandidate: 10 })).toEqual(search);
  });

  it('softmaxPick with temperature 0 always takes the best value', () => {
    const candidates = [0.4, 0.5, 0.45].map((value, i): CandidateValue => ({
      point: { x: i, y: 0 },
      prior: 0,
      wins: 0,
      playouts: 1,
      meanMargin: 0,
      value,
    }));
    for (let seed = 1; seed <= 10; seed++)
      expect(softmaxPick(candidates, createRng(seed), 0)).toBe(1);
  });
});
