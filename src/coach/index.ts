// Game coaching for 9×9 (spec docs/specs/M6-game-coaching.md): move notes, the 提示 hint and the
// post-game review 复盘. Pure TS: the engine computes the facts, the text is i18n keys.
export {
  NOTE_PRIORITY,
  factParams,
  moveNote,
  pickFact,
  pickNote,
  type CoachFact,
  type CoachFactKind,
  type CoachNote,
} from './facts';
export {
  HINTS_PER_GAME,
  hintCategory,
  hintFor,
  hintNote,
  type Hint,
  type HintCategory,
} from './hint';
export {
  BIG_CAPTURE_MIN,
  LOST_GROUP_MIN,
  REVIEW_CHUNK,
  REVIEW_MIN_MOVES,
  SWING_FROM_PLY,
  SWING_MAX_PLIES,
  SWING_PLAYOUTS,
  SWING_POSITIONS,
  SWING_THRESHOLD,
  atariSince,
  buildReview,
  evaluatePosition,
  planReview,
  reviewMoments,
  type MomentKind,
  type ReviewMoment,
  type ReviewPlan,
} from './review';
