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
/** A starting position, optionally followed by prelude moves (exercises only). */
export interface StartDef extends PositionDef {
  prelude?: MoveDef[];
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
  /** Set by `npm run import:sgf` on generated files: the `.src.json` it came from. */
  generatedFrom?: string;
  /** Show coordinates on every board of this lesson. Default false. */
  coordinates?: boolean;
  /** 'lesson': 2–4 steps. 'checkpoint': omitted or []. */
  explain?: ExplainStep[];
  /** 5–10 exercises (2–6 when all are play-bot games), played in the authored order. */
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
  /**
   * Moves played with the engine from `setup` before the exercise appears (spec M5 §5): the
   * board, the side to move and the ko ban are those after them. Not for play-bot games.
   */
  prelude?: MoveDef[];
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

export type BotLevel = 1 | 2 | 3;
/** Capture Go: the first side to capture `n` stones wins. M6 adds { kind: 'score' }. */
export type GameWin = { kind: 'captureN'; n: number };

/** A game against the bot (M4 item 2, spec docs/specs/M4-bot-capture-go.md §7.1). */
export interface PlayBotExercise extends ExerciseBase {
  type: 'play-bot';
  win: GameWin;
  /** blunder: 0..1, default 0. seed: tests and replays only (default: random per attempt). */
  bot: { level: BotLevel; blunder?: number; seed?: number };
  /** The learner's colour. Default 'B'. */
  player?: Color;
  /** Who moves first. Default 'B'. */
  first?: Color;
  /** Safety net in plies. Default 2 × size × size. */
  maxMoves?: number;
}

/** `line`: the authored line is the truth (legal only). `capture`: the line captures `target`. */
export type SequenceGoal = { kind: 'line' } | { kind: 'capture'; target: Vertex };

/** A learner mistake (`line[0]`) and its scripted refutation (the rest). */
export interface SequenceBranch {
  line: MoveDef[];
  whyKey?: TextKey;
}

/**
 * How learner moves are judged (spec docs/specs/M5-sequence-v2.md §3.6). `line` (default): only
 * the move of the line is right. `search`: any move after which the target is captured within
 * `maxMoves` learner moves against every escape (`opponent: 'run'`); needs a capture goal, no
 * `wrong` branches, and a line that ends with the learner's capturing move.
 */
export type SequenceJudge =
  | { kind: 'line' }
  | {
      kind: 'search';
      opponent: 'run';
      /** Default ceil(line.length / 2), at most 8. */ maxMoves?: number;
    };

/** The most learner moves a search-judged problem may allow (validator SEQ_BAD_JUDGE). */
export const SEARCH_MAX_MOVES = 8;

/**
 * A multi-move problem (spec docs/specs/M5-sgf-import.md §6), usually imported from SGF. Even
 * indexes of `line` are the learner's moves, odd indexes are scripted replies (the replies the
 * search shows, for `judge.kind: 'search'`). `line` is the canonical answer.
 */
export interface SequenceExercise extends ExerciseBase {
  type: 'sequence';
  toPlay: Color;
  goal: SequenceGoal;
  line: MoveDef[];
  wrong?: SequenceBranch[];
  judge?: SequenceJudge;
}

export type Exercise =
  | TapPointExercise
  | PlayMoveExercise
  | ChoiceExercise
  | CountExercise
  | PlayBotExercise
  | SequenceExercise;
export type ExerciseType = Exercise['type'];
export const EXERCISE_TYPES: readonly ExerciseType[] = [
  'tap-point',
  'play-move',
  'choice',
  'count',
  'play-bot',
  'sequence',
];

/** What the runner needs to check an answer and to show it (§4.3). */
export type Solution = { points: Vertex[] } | { index: number } | { value: number };

export type Language = 'zh-CN' | 'en' | 'fr';
export const TEXT_LANGUAGES: readonly Language[] = ['zh-CN', 'en', 'fr'];

export interface ValidationContext {
  hasText?: (key: string, lang: Language) => boolean;
  /** Node budget for proving search-judged sequences (tests only; default 3 000, §3.5). */
  searchNodes?: number;
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
  /** The unit's first lesson. */
  lesson: Lesson | null;
  /** Further lessons of the unit, in order (M5-life-death: Unit 11 has two). Default none. */
  laterLessons?: Lesson[];
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
