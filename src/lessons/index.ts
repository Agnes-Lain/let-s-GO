// Lesson model, validator, goals, stars, unlocks and loader (spec docs/specs/M3-lesson-framework.md).
// Pure TS: uses src/engine only (no React / React Native / Expo).
export * from './schema';
export { MAX_ERRORS, validateCatalog, validateLesson } from './validate';
export {
  capturedCount,
  getSolution,
  goalMet,
  libertyVertices,
  playMoveSolutions,
  solutionPoints,
  startState,
} from './goals';
export { STAR_RULES, computeStars, countOutcomes, type Stars } from './stars';
export {
  SAMPLE_UNIT,
  isCheckpointUnlocked,
  isLessonUnlocked,
  isUnlocked,
  mapNodes,
  newlyUnlockedUnit,
  nextNode,
  starsOf,
} from './unlock';
export {
  PLANNED_UNITS,
  createLessonLoader,
  getUnits,
  hasTextIn,
  listLessons,
  loadLesson,
  type ListOptions,
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
