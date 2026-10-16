// Go rules engine (pure TS, Chinese rules). No React/RN/Expo, timers, randomness or I/O.
// Spec: docs/specs/M1-rules-engine.md

export {
  EngineError,
  type Board,
  type BoardSize,
  type Color,
  type EngineErrorCode,
  type GameOptions,
  type GameState,
  type Group,
  type IllegalReason,
  type Move,
  type MoveFacts,
  type PassResult,
  type PlayResult,
  type Point,
  type ScoreResult,
  type ScoreSide,
  type Vertex,
} from './types';
export { BOARD_SIZES, isBoardSize, parseVertex, toVertex } from './coordinates';
export { createGame, defaultKomi } from './game';
export { groupAt, isAtari, liberties } from './groups';
export { parseBoard, printBoard } from './ascii';
