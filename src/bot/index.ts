// Beginner bots (pure TS; specs docs/specs/M4-bot-capture-go.md §6, docs/specs/M6-bot-levels.md §6). No React, timers, clock or
// global randomness: randomness comes only from the injected Rng, so games replay from their seed.
export { chooseMove, level2, level3 } from './choose';
export {
  MAX_PLAY_ON,
  MAX_PLIES_9,
  botIsAhead,
  opponentJustPassed,
  passAfterOpponentPass,
  playOnStreak,
} from './board9';
export {
  DEAD_PLAYOUTS,
  DEAD_PLAYOUT_PLIES,
  DEAD_RATE,
  deadStonesOf,
  judgeDeadMarks,
  judgeGroups,
  proposeDead,
  type DeadDispute,
  type DeadMarksJudgement,
  type GroupJudgement,
  type GroupStatus,
} from './deadStones';
export { isOwnEye } from './eyes';
export { OPENING_EMPTY_POINTS } from './heuristic';
export {
  PASS_BELOW,
  playableMoves,
  scoreMoves,
  settledOwners,
  type MoveKind,
  type ScoredMove,
} from './level2';
export {
  MC_CANDIDATES,
  MC_MAX_PLIES,
  MC_PLAYOUTS,
  MC_PLAYOUTS_PER_CANDIDATE,
  MC_PRIOR_WEIGHT,
  MC_TEMPERATURE,
  level3Search,
  softmaxPick,
  type CandidateValue,
  type Level3Search,
} from './level3';
export { createRng, deriveSeed, type Rng } from './rng';
export { winRate } from './playout';
export { exposedStones } from './analysis';
export type { BotChoice, BotLevel, BotOptions, BotReason } from './types';
export {
  botRng,
  captureGoStatus,
  playCaptureGo,
  referencePlayout,
  type CaptureGoConfig,
  type CaptureGoRules,
  type CaptureGoStatus,
  type Player,
  type PlayoutResult,
} from './captureGo';
export {
  FORCED_CAPTURE_MAX_NODES,
  defenderReplies,
  forcedCapture,
  judgeAttack,
  winningMoves,
  type AttackJudgement,
  type AttackReply,
  type CaptureProblem,
  type CaptureSearch,
  type WinningMoves,
} from './forcedCapture';
