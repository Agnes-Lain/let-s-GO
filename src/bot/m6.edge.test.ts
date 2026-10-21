// QA edge cases for M6 (docs/specs/M6-bot-levels.md): ko, suicide, own eyes, seki at game end,
// komi 5.5 (no draw), dead-stone negotiation corners.
import {
  createGame,
  checkMove,
  isBoardSize,
  parseBoard,
  pass,
  play,
  score,
  type GameState,
} from '@/engine';
import { isOwnEye } from './index';
import { chooseMove, createRng, botRng, judgeGroups, judgeDeadMarks, type BotLevel } from './index';
import { gameReducer, startSession, type GameSession } from '@/game9/session';
import { position, vertexOf, playAt } from './__fixtures__/board';

const LEVELS: BotLevel[] = [1, 2, 3];

describe('ko: the bot never recaptures at once, may after a move elsewhere', () => {
  it('after Black takes the ko, White (any level, 15 seeds) never plays the forbidden point', () => {
    // White stone at e5 is in atari (d5 empty, others: e6 O? use clean diagram instead)
    const ko = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . X O . . . .
      5 . . X O . O . . .
      4 . . . X O . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
    `,
      'B',
    );
    const taken = playAt(ko, 'e5'); // captures d5, black e5 now in atari at d5
    expect(taken.board.cells.filter((c) => c === 'W').length).toBe(3);
    expect(checkMove(taken, { x: 3, y: 4 })).toMatchObject({ legal: false, reason: 'ko' });
    for (const level of LEVELS)
      for (let seed = 1; seed <= 15; seed++) {
        const c = chooseMove(taken, { level, rng: createRng(seed), board9: true, blunder: 0.5 });
        expect(vertexOf(c.move, 9)).not.toBe('d5');
        if (c.move.type === 'play') expect(checkMove(taken, c.move.point).legal).toBe(true);
      }
  });
});

describe('suicide: never played, a capturing "suicide" is allowed', () => {
  // a1 corner: Black playing a1 is suicide for Black (b1, a2 white, a1 no capture).
  const SUICIDE = position(
    `
    9 . . . . . . . . .
    8 . . . . . . . . .
    7 . . . . . . . . .
    6 . . . . . . . . .
    5 . . . . . . . . .
    4 . . . . . . . . .
    3 X X . . . . . . .
    2 O X . . . . . . .
    1 . O X . . . . . .
  `,
    'W',
  );
  it('a1 looks suicidal for Black but captures a2: legal; a real suicide is refused', () => {
    const black = { ...SUICIDE, toPlay: 'B' as const };
    expect(checkMove(black, { x: 0, y: 0 })).toMatchObject({ legal: true });
    const real = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 O . . . . . . . .
      1 . O . . . . . . .
    `,
      'B',
    );
    expect(checkMove(real, { x: 0, y: 0 })).toMatchObject({ legal: false, reason: 'suicide' });
    for (const level of LEVELS)
      for (let seed = 1; seed <= 10; seed++) {
        const c = chooseMove(real, { level, rng: createRng(seed), board9: true, blunder: 0.5 });
        expect(vertexOf(c.move, 9)).not.toBe('a1');
      }
  });
  it('all levels return a legal move for both colours on a cramped board', () => {
    for (const toPlay of ['B', 'W'] as const)
      for (const level of LEVELS)
        for (let seed = 1; seed <= 10; seed++) {
          const s = { ...SUICIDE, toPlay };
          const c = chooseMove(s, { level, rng: createRng(seed), board9: true, blunder: 0.5 });
          if (c.move.type === 'play') expect(checkMove(s, c.move.point).legal).toBe(true);
        }
  });
});

describe('own true eyes are never filled over whole games', () => {
  it('self-play L1(blunder .5)/L2/L3 never plays into an own eye', () => {
    for (const [b, w] of [
      [2, 2],
      [1, 3],
      [3, 1],
    ] as [BotLevel, BotLevel][]) {
      let state: GameState = createGame(9, { komi: 5.5 });
      while (!state.isOver && state.moves.length < 200) {
        const level = state.toPlay === 'B' ? b : w;
        const { move } = chooseMove(state, {
          level,
          rng: botRng(11 + (state.toPlay === 'W' ? 7919 : 0), state.moves.length),
          board9: true,
          blunder: level === 1 ? 0.5 : 0,
        });
        if (move.type === 'play') {
          // a point that is a true eye for its own colour AND whose group would have 1 liberty
          // is the only "real" fill; level 1 with blunder may fill, so only assert L2/L3.
          if (level !== 1) expect(isOwnEye(state.board, move.point, state.toPlay)).toBe(false);
        }
        const r = move.type === 'pass' ? pass(state) : play(state, move.point);
        if (!r.ok) throw new Error(r.reason);
        state = r.state;
      }
      expect(state.isOver).toBe(true);
      expect(isBoardSize(state.board.size)).toBe(true);
      // komi 5.5: never a draw
      expect(score(state.board, { komi: 5.5 }).winner).not.toBeNull();
    }
  });
});

describe('score with komi 5.5 (no draw possible)', () => {
  it('15 vs 10 on 5x5: White wins by 0.5; 20 vs 5: Black by 9.5', () => {
    const rows = (n: number) =>
      [5, 4, 3, 2, 1].map((r) => `${r} ${'X '.repeat(n)}${'O '.repeat(5 - n)}`.trim()).join('\n');
    const letters = '  a b c d e';
    const a1 = score(parseBoard(`${rows(3)}\n${letters}`).board, { komi: 5.5 });
    expect(a1.winner).toBe('W');
    expect(a1.margin).toBe(0.5);
    const a2 = score(parseBoard(`${rows(4)}\n${letters}`).board, { komi: 5.5 });
    expect(a2.winner).toBe('B');
    expect(a2.margin).toBe(9.5);
  });
});

describe('seki at the end of a game', () => {
  const SEKI = `
    9 . . . . . . . . .
    8 . . . . . . . . .
    7 X X X X X X X X .
    6 X O O O O O O X .
    5 X O X X X X O X .
    4 X O . . O O O X .
    3 X O O O O O O X .
    2 X X X X X X X X .
    1 . . . . . . . . .
  `;
  function finishedSession(): GameSession {
    const game = position(SEKI, 'B');
    const moves = new Array(10).fill({ type: 'play', color: 'B', point: { x: 0, y: 0 } });
    const g: GameState = { ...game, komi: 5.5, moves };
    return gameReducer({ ...startSession(2, 1), game: g }, { type: 'countNow' });
  }

  it('marking a seki group is "unsure": the learner marks stand and the count opens', () => {
    let s = finishedSession();
    expect(s.phase).toBe('mark');
    s = gameReducer(s, { type: 'mark', at: 'c5' });
    s = gameReducer(s, { type: 'markDone' });
    expect(s.phase).toBe('count');
    expect(s.note).toMatchObject({ key: 'game9.dispute.unsure' });
  });

  it('not marking the seki groups is agreed (neither side is proposed dead)', () => {
    const j = judgeGroups(finishedSession().game, createRng(1));
    expect(judgeDeadMarks(j, []).disputes.filter((d) => d.kind === 'propose')).toEqual([]);
  });
});

describe('Count now when the bot is behind (it would not pass) still forces its pass', () => {
  it('level 2 and 3, black far ahead, bot to answer: both passes, mark phase', () => {
    for (const level of [2, 3] as BotLevel[]) {
      let game = createGame(9, { komi: 5.5 });
      const moves = ['c1', 'a9', 'c2', 'a8', 'c3', 'b9', 'c4', 'b8', 'c5', 'a7'];
      for (const v of moves) {
        const r = play(game, v);
        if (!r.ok) throw new Error(v);
        game = r.state;
      }
      const s = gameReducer({ ...startSession(level, 5), game }, { type: 'countNow' });
      expect(s.phase).toBe('mark');
      expect(s.game.moves.slice(-2).map((m) => m.type)).toEqual(['pass', 'pass']);
    }
  });
});

describe('resign', () => {
  it('Resign ends at once as a resignation, learner loses, nothing else is possible', () => {
    let s = startSession(2, 3);
    s = gameReducer(s, { type: 'resign' });
    expect(s.phase).toBe('result');
    expect(s.result?.kind).toBe('resigned');
  });
});
