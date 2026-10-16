import { checkMove, createGame, legalMoves, pass, play, type GameState } from './index';

function passOk(state: GameState): GameState {
  const result = pass(state);
  if (!result.ok) throw new Error('expected pass to be ok');
  return result.state;
}

function playOk(state: GameState, vertex: string): GameState {
  const result = play(state, vertex);
  if (!result.ok) throw new Error(`expected ${vertex} to be legal, got ${result.reason}`);
  return result.state;
}

describe('pass and end of game', () => {
  it('AC 26: one pass switches the turn and counts 1; the game is not over', () => {
    const s = passOk(createGame(5));
    expect(s.toPlay).toBe('W');
    expect(s.consecutivePasses).toBe(1);
    expect(s.isOver).toBe(false);
    expect(s.moves).toEqual([{ type: 'pass', color: 'B' }]);
  });

  it('AC 26: a play after a pass resets the count to 0', () => {
    const s = playOk(passOk(createGame(5)), 'c3');
    expect(s.consecutivePasses).toBe(0);
    expect(s.isOver).toBe(false);
    expect(s.toPlay).toBe('B');
  });

  it('AC 26: B pass, W c3, B pass, W pass ends the game', () => {
    let s = createGame(5);
    s = passOk(s); // B
    s = playOk(s, 'c3'); // W
    s = passOk(s); // B
    expect(s.consecutivePasses).toBe(1);
    expect(s.isOver).toBe(false);
    s = passOk(s); // W
    expect(s.consecutivePasses).toBe(2);
    expect(s.isOver).toBe(true);
    expect(s.moves).toEqual([
      { type: 'pass', color: 'B' },
      { type: 'play', color: 'W', point: { x: 2, y: 2 } },
      { type: 'pass', color: 'B' },
      { type: 'pass', color: 'W' },
    ]);
  });

  it('AC 26: after game over, play returns game-over and pass returns ok:false', () => {
    const over = passOk(passOk(createGame(5)));
    expect(over.isOver).toBe(true);
    expect(play(over, 'c3')).toEqual({ ok: false, reason: 'game-over' });
    expect(pass(over)).toEqual({ ok: false, reason: 'game-over' });
    expect(checkMove(over, 'c3')).toEqual({ legal: false, reason: 'game-over' });
    expect(legalMoves(over)).toEqual([]);
  });

  it('AC 26: passes that are not consecutive never end the game', () => {
    let s = createGame(5);
    for (const vertex of ['c3', 'd3', 'c4']) {
      s = passOk(s);
      s = playOk(s, vertex);
      expect(s.isOver).toBe(false);
      expect(s.consecutivePasses).toBe(0);
    }
  });

  it('AC 26: ending the game keeps the board, captures and komi', () => {
    const start = playOk(createGame(5, { komi: 6 }), 'c3');
    const over = passOk(passOk(start));
    expect(over.board).toEqual(start.board);
    expect(over.captures).toEqual(start.captures);
    expect(over.komi).toBe(6);
    expect(over.koPoint).toBeNull();
  });
});
