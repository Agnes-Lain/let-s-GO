// Lesson model (spec docs/specs/M3-lesson-framework.md §4.2). Types only, no runtime deps.
import type { Color, Vertex } from '@/engine';

/** M3 supports 5, 7 and 9. 13 / 19 are added by the milestone that first needs them. */
export type LessonSize = 5 | 7 | 9;
export const LESSON_SIZES: readonly LessonSize[] = [5, 7, 9];

/** An i18n key; the text must exist in zh-CN, en and fr. */
export type TextKey = string;

export interface Setup {
  B?: Vertex[];
  W?: Vertex[];
}
export interface PositionDef {
  size: LessonSize;
  setup: Setup;
}

export type HighlightKind = 'liberty' | 'hint' | 'success' | 'error';
export type HighlightDef = { kind: HighlightKind; points: Vertex[] };
export type MarkerDef =
  | { kind: 'circle' | 'triangle' | 'square' | 'cross'; at: Vertex }
  | { kind: 'label'; at: Vertex; text: string };
export interface MoveDef {
  color: Color;
  at: Vertex;
}

export interface Lesson {
  schema: 1;
  /** 'u' + 2-digit unit + '-' + slug, e.g. 'u04-capture'. */
  id: string;
  /** 0 = developer sample (hidden in production builds). 1–16 = curriculum units. */
  unit: number;
  /** 'lesson' = explain + practice set; 'checkpoint' = practice set only. */
  kind: 'lesson' | 'checkpoint';
  titleKey: TextKey;
  /** Show coordinates on every board of this lesson. Default false. */
  coordinates?: boolean;
  /** 'lesson': 2–4 steps. 'checkpoint': omitted or []. */
  explain?: ExplainStep[];
  /** 5–10 exercises, played in the authored order. */
  exercises: Exercise[];
}

export interface ExplainStep {
  /** Required on the first step. Omitted = continue from the END position of the previous step. */
  board?: PositionDef;
  /** Played automatically, in order, when the step is entered (and on Replay). */
  moves?: MoveDef[];
  /** Drawn on the step's START position; hidden once the first move starts playing. */
  highlights?: HighlightDef[];
  /** Drawn on the board for the whole step. */
  markers?: MarkerDef[];
  textKey: TextKey;
}

interface ExerciseBase extends PositionDef {
  /** Unique within the lesson: [a-z0-9-]+ . */
  id: string;
  promptKey: TextKey;
  hintKey?: TextKey;
  /** Points that pulse when the hint is shown. Subset of the solution points. */
  hintPoints?: Vertex[];
  /** Shown after a correct answer and when the answer is revealed. */
  explainKey?: TextKey;
  markers?: MarkerDef[];
}

export type LibertiesOf = { libertiesOf: Vertex };

export interface TapPointExercise extends ExerciseBase {
  type: 'tap-point';
  mode: 'one' | 'all';
  answer: { points: Vertex[] } | LibertiesOf;
}

export type Goal =
  | { kind: 'point'; points: Vertex[] }
  | { kind: 'capture'; min?: number }
  | { kind: 'atari' }
  | { kind: 'connect'; a: Vertex; b: Vertex }
  | { kind: 'save'; target: Vertex };

export interface PlayMoveExercise extends ExerciseBase {
  type: 'play-move';
  toPlay: Color;
  goal: Goal;
}

export interface ChoiceOption {
  textKey: TextKey;
  correct?: boolean;
  whyKey?: TextKey;
}
export interface ChoiceExercise extends ExerciseBase {
  type: 'choice';
  options: ChoiceOption[];
}

export interface CountExercise extends ExerciseBase {
  type: 'count';
  answer: number | LibertiesOf;
}

export type Exercise = TapPointExercise | PlayMoveExercise | ChoiceExercise | CountExercise;
export type ExerciseType = Exercise['type'];
export const EXERCISE_TYPES: readonly ExerciseType[] = [
  'tap-point',
  'play-move',
  'choice',
  'count',
];

/** What the runner needs to check an answer and to show it (§4.3). */
export type Solution = { points: Vertex[] } | { index: number } | { value: number };

export type Language = 'zh-CN' | 'en' | 'fr';
export const TEXT_LANGUAGES: readonly Language[] = ['zh-CN', 'en', 'fr'];

export interface ValidationContext {
  hasText?: (key: string, lang: Language) => boolean;
}
export interface LessonError {
  code: string;
  path: string;
  message: string;
}
export type ValidationResult = { ok: true; lesson: Lesson } | { ok: false; errors: LessonError[] };

/** One exercise's result (§5.1). */
export type Outcome = 'clean' | 'solved' | 'revealed';

/** One unit on the map (§4.6). `lesson: null` = planned, no content yet ("coming soon"). */
export interface UnitEntry {
  unit: number;
  titleKey: TextKey;
  lesson: Lesson | null;
  checkpoint: Lesson | null;
}

/** Best stars per lesson id, as far as unlock rules need to know. */
export type StarsByLesson = Readonly<Record<string, { stars: number } | undefined>>;

/** A playable node on the map: a unit's lesson or its checkpoint. */
export interface MapNode {
  unit: number;
  kind: Lesson['kind'];
  lesson: Lesson;
}
