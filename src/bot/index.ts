// Beginner bot (pure TS; spec docs/specs/M4-bot-capture-go.md §6). No React, timers, clock or
// global randomness: randomness comes only from the injected Rng, so games replay from their seed.
export { chooseMove } from './choose';
export { createRng, deriveSeed, type Rng } from './rng';
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
