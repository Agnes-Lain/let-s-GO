// QA edge cases for M1 PR 3 pass / end of game (spec §4 D AC 26, decision D8).

import {
  checkMove,
  createGame,
  legalMoves,
  pass,
  play,
  score,
  type GameState,
  type Vertex,
} from './index';

function passOk(state: GameState): GameState {
  const result = pass(state);
  if (!result.ok) throw new Error('expected pass to be ok');
  return result.state;
}

function playOk(state: GameState, at: Vertex): GameState {
  const result = play(state, at);
  if (!result.ok) throw new Error(`expected ${at} to be legal, got ${result.reason}`);
  return result.state;
}

// AC 21 ko shape, B to play d3:
// 4 . . X O .
// 3 . X O . O      W c3 has only d3; B d3 then has only c3 -> ko, koPoint c3.
// 2 . . X O .
function koGame(): GameState {
  return createGame(5, { setup: { B: ['c4', 'b3', 'c2'], W: ['d4', 'c3', 'e3', 'd2'] } });
}

describe('QA: passes interleaved with ko', () => {
  it('B takes the ko, W passes (lifts the ban), B passes -> game over, nothing else changes', () => {
    const taken = playOk(koGame(), 'd3');
    expect(taken.koPoint).toEqual({ x: 2, y: 2 });
    expect(taken.captures).toEqual({ B: 1, W: 0 });

    const wPass = passOk(taken);
    expect(wPass.koPoint).toBeNull();
    expect(wPass.consecutivePasses).toBe(1);
    expect(wPass.isOver).toBe(false);
    expect(wPass.toPlay).toBe('B');

    const over = passOk(wPass);
    expect(over.isOver).toBe(true);
    expect(over.consecutivePasses).toBe(2);
    expect(over.board).toEqual(taken.board);
    expect(over.captures).toEqual({ B: 1, W: 0 });
    expect(over.koPoint).toBeNull();
    expect(over.moves).toEqual([
      { type: 'play', color: 'B', point: { x: 3, y: 2 } },
      { type: 'pass', color: 'W' },
      { type: 'pass', color: 'B' },
    ]);

    // Game over beats every other reason, including the former ko point and occupied points.
    expect(play(over, 'c3')).toEqual({ ok: false, reason: 'game-over' });
    expect(play(over, 'd3')).toEqual({ ok: false, reason: 'game-over' });
    expect(checkMove(over, 'c3')).toEqual({ legal: false, reason: 'game-over' });
    expect(legalMoves(over)).toEqual([]);
    expect(pass(over)).toEqual({ ok: false, reason: 'game-over' });
    // Refused calls leave the finished state untouched.
    expect(over.moves).toHaveLength(3);
    expect(over.isOver).toBe(true);
  });

  it('after W passes in the ko, B fills c3 and the count resets; a later W retake is impossible', () => {
    let s = passOk(playOk(koGame(), 'd3')); // W passes
    s = playOk(s, 'c3'); // B connects the ko
    expect(s.consecutivePasses).toBe(0);
    expect(s.isOver).toBe(false);
    s = passOk(s); // W
    expect(s.isOver).toBe(false);
    s = passOk(s); // B
    expect(s.isOver).toBe(true);
    expect(s.moves.map((m) => m.type)).toEqual(['play', 'pass', 'play', 'pass', 'pass']);
  });

  it('W pass then B pass ends the game before W could ever retake the ko', () => {
    // After B d3 and W pass, it is B's turn; the only way for the game to continue to a W
    // retake is a B play. A B pass ends the game instead of handing W the ko.
    const over = passOk(passOk(playOk(koGame(), 'd3')));
    expect(over.isOver).toBe(true);
    expect(play(over, 'c3')).toEqual({ ok: false, reason: 'game-over' });
  });
});

describe('QA: end of game details', () => {
  it('a game starting with W to play ends after W pass, B pass', () => {
    const over = passOk(passOk(createGame(7, { toPlay: 'W' })));
    expect(over.isOver).toBe(true);
    expect(over.moves).toEqual([
      { type: 'pass', color: 'W' },
      { type: 'pass', color: 'B' },
    ]);
  });

  it('three passes are impossible: the third returns game-over', () => {
    const over = passOk(passOk(createGame(9)));
    expect(pass(over)).toEqual({ ok: false, reason: 'game-over' });
  });

  it('pass, play, pass, pass: only the last two count', () => {
    let s = passOk(createGame(5)); // B
    s = playOk(s, 'c3'); // W
    expect(s.consecutivePasses).toBe(0);
    s = passOk(s); // B
    expect(s.isOver).toBe(false);
    s = passOk(s); // W
    expect(s.isOver).toBe(true);
  });

  it('a finished game can be scored from its board; captures play no role', () => {
    // W captures c3 (AC 13), then both pass.
    let s = createGame(5, { setup: { B: ['c3'], W: ['c2', 'b3', 'd3'] }, toPlay: 'W' });
    s = playOk(s, 'c4');
    s = passOk(passOk(s));
    expect(s.isOver).toBe(true);
    expect(s.captures).toEqual({ B: 0, W: 1 });
    const result = score(s.board, { komi: s.komi });
    // 4 white stones + 21 empty points touching only white; komi 0.5.
    expect(result.white).toEqual({ stones: 4, territory: 21, komi: 0.5, total: 25.5 });
    expect(result.result).toBe('W+25.5');
  });

  it.each([5, 7, 9, 13, 19] as const)('size %i: two passes end the game', (size) => {
    const over = passOk(passOk(createGame(size)));
    expect(over.isOver).toBe(true);
    expect(legalMoves(over)).toEqual([]);
  });
});
