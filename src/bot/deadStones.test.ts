// Spec docs/specs/M6-bot-levels.md §6.4, AC 26–29: the bot's dead-stone opinion.
import { pass, type GameState } from '@/engine';

import {
  createRng,
  deadStonesOf,
  judgeDeadMarks,
  judgeGroups,
  proposeDead,
  type GroupJudgement,
} from './index';
import { position } from './__fixtures__/board';

/** A finished game: the position after two passes. */
function finished(ascii: string): GameState {
  let state = position(ascii, 'B');
  for (let i = 0; i < 2; i++) {
    const result = pass(state);
    if (!result.ok) throw new Error('pass');
    state = result.state;
  }
  return state;
}

/**
 * Black owns the left, White the right (walls on e and f). White's c3 and Black's h4 are lone
 * stones deep in enemy land; White's b8 stone is in atari (its one liberty is b9).
 */
const ENDGAME = finished(`
  9 . . X . X O . . .
  8 X O X . X O . . .
  7 . X X . X O . . .
  6 . . . . X O . . .
  5 . . . . X O . . .
  4 . . . . X O . X .
  3 . . O . X O . . .
  2 . . . . X O . . .
  1 . . . . X O . . .
`);

const at = (judgements: GroupJudgement[], v: string) =>
  judgements.find((j) => j.stones.includes(v)) as GroupJudgement;

describe('judgeGroups (§6.4)', () => {
  const judgements = judgeGroups(ENDGAME, createRng(1));

  it('proves a group in atari dead with forcedCapture', () => {
    const b8 = at(judgements, 'b8');
    expect(b8.liberties).toBe(1);
    expect(b8.status).toBe('proved-dead');
  });

  it('calls lone stones in enemy land dead by playouts', () => {
    expect(at(judgements, 'c3').status).toMatch(/dead/);
    expect(at(judgements, 'h4').status).toMatch(/dead/);
  });

  it('calls the two big walls alive', () => {
    expect(at(judgements, 'e5').status).toBe('alive');
    expect(at(judgements, 'f5').status).toBe('alive');
  });

  it('is deterministic for one seed', () => {
    expect(judgeGroups(ENDGAME, createRng(1))).toEqual(judgements);
    expect(proposeDead(ENDGAME, createRng(1))).toEqual(deadStonesOf(judgements));
  });
});

describe('two eyes and seki', () => {
  // White's corner group has two eyes (a1, c1) and is surrounded by Black.
  const TWO_EYES = finished(`
    9 . . . . . . . . .
    8 . . . . . . . . .
    7 . . . . . . . . .
    6 . . . . . . . . .
    5 . . . . . . . . .
    4 . . . . . . . . .
    3 X X X X X . . . .
    2 O O O O X . . . .
    1 . O . O X . . . .
  `);

  it('a group with two eyes is alive and has eyes = 2', () => {
    const white = at(judgeGroups(TWO_EYES, createRng(2)), 'b2');
    expect(white.status).toBe('alive');
    expect(white.eyes).toBe(2);
    expect(white.liberties).toBe(2);
  });

  // Seki (双活 shuānghuó): Black c5–f5 and the white ring share the liberties c4 and d4; whoever
  // fills one is captured, and the captured shape is too big to kill. (The designer's first try,
  // a 2-stone inner group, is not seki: after the capture Black kills the bent three.)
  const SEKI = finished(`
    9 . . . . . . . . .
    8 . . . . . . . . .
    7 X X X X X X X X .
    6 X O O O O O O X .
    5 X O X X X X O X .
    4 X O . . O O O X .
    3 X O O O O O O X .
    2 X X X X X X X X .
    1 . . . . . . . . .
  `);

  it('a seki group is never proved dead', () => {
    const judgements = judgeGroups(SEKI, createRng(3));
    for (const v of ['c5', 'b5']) {
      expect(at(judgements, v).liberties).toBe(2);
      expect(at(judgements, v).status).toBe('undecided');
    }
  });
});

describe('judgeDeadMarks (AC 26–29)', () => {
  const judgements = judgeGroups(ENDGAME, createRng(1));
  const proposal = deadStonesOf(judgements);

  it('AC 27: marks equal to the proposal are agreed', () => {
    expect(judgeDeadMarks(judgements, proposal)).toEqual({ agreed: true, disputes: [] });
  });

  it('AC 28: a marked alive group is disputed with its facts', () => {
    const result = judgeDeadMarks(judgements, [...proposal, 'e5']);
    expect(result.agreed).toBe(false);
    expect(result.disputes).toEqual([
      { kind: 'alive', group: expect.objectContaining({ at: 'e1', status: 'alive' }) },
    ]);
  });

  it('AC 29: an unmarked proved-dead group is proposed', () => {
    const result = judgeDeadMarks(
      judgements,
      proposal.filter((v) => v !== 'b8'),
    );
    expect(result.disputes[0]).toEqual({
      kind: 'propose',
      groups: [expect.objectContaining({ at: 'b8' })],
    });
  });

  it('AC 29: an unmarked group that is dead only by playouts is "unsure"', () => {
    const playoutDead = judgements.find((j) => j.status === 'dead') as GroupJudgement;
    const result = judgeDeadMarks(
      judgements,
      proposal.filter((v) => !playoutDead.stones.includes(v)),
    );
    expect(result.disputes).toEqual([{ kind: 'unsure', group: playoutDead }]);
  });

  it('a group counts as marked when any of its stones is marked', () => {
    const e = at(judgements, 'e5');
    expect(judgeDeadMarks(judgements, [...proposal, e.stones[3]]).disputes[0].kind).toBe('alive');
  });
});
