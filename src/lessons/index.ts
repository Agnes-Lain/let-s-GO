// Lesson model, validator, goals, stars, unlocks and loader (spec docs/specs/M3-lesson-framework.md).
// Pure TS: uses src/engine only (no React / React Native / Expo).
export * from './schema';
export { MAX_ERRORS, validateCatalog, validateLesson } from './validate';
export {
  capturedCount,
  getSolution,
  goalMet,
  lastPlayedPoint,
  libertyVertices,
  playMoveSolutions,
  solutionPoints,
  startState,
} from './goals';
export {
  groupStones,
  markAnswer,
  otherColor,
  ownerOf,
  proofOutcome,
  scoreFacts,
  scoreValue,
  winnerOf,
  type ScoreFacts,
  type SideFacts,
} from './scoring';
export { STAR_RULES, computeStars, countOutcomes, type Stars } from './stars';
export {
  isCheckpointUnlocked,
  isLessonUnlocked,
  isUnlocked,
  mapNodes,
  newlyUnlockedUnit,
  nextNode,
  starsOf,
  unitLessons,
} from './unlock';
export {
  PLANNED_UNITS,
  createLessonLoader,
  getUnits,
  hasTextIn,
  listLessons,
  loadLesson,
  type LessonLoader,
  type LoadResult,
} from './loader';
export {
  endCells,
  explainFrames,
  toStepMarkers,
  type Cells,
  type MoveFrame,
  type StepFrames,
  type StepHighlight,
  type StepMarker,
} from './explain';
export { mapRows, nodeTitleKey, type MapRow, type NodeState } from './map';
export {
  MODULES,
  defaultExpandedModules,
  moduleOf,
  moduleSummaries,
  type ModuleDef,
  type ModuleId,
  type ModuleSummary,
} from './modules';
