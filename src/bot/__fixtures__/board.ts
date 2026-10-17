// Test helpers for src/bot (not shipped code paths; imported only by *.test.ts files).
import {
  createGame,
  parseBoard,
  play,
  toVertex,
  type Color,
  type GameState,
  type Move,
} from '@/engine';

/** A game on an ASCII board ('.' empty, 'X' black, 'O' white) with `toPlay` to move. */
export function position(ascii: string, toPlay: Color): GameState {
  const { board } = parseBoard(ascii);
  return { ...createGame(board.size, { toPlay }), board };
}

/** Vertex of a play move, or 'pass'. */
export function vertexOf(move: Move, size: number): string {
  return move.type === 'pass' ? 'pass' : toVertex(move.point, size as 5);
}

/** Plays a vertex and returns the new state (throws when illegal). */
export function playAt(state: GameState, at: string): GameState {
  const result = play(state, at);
  if (!result.ok) throw new Error(`${at} is illegal: ${result.reason}`);
  return result.state;
}
