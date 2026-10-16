// Lesson validator (spec §4.4). Pure: uses src/engine only. Reports every error (up to 50),
// with English messages for authors and a JSON path such as 'exercises[2].goal'.
import {
  createGame,
  groupAt,
  parseVertex,
  toVertex,
  type Color,
  type GameState,
  type Vertex,
} from '@/engine';

import { isLegalMove, libertyVertices, playAs, playMoveSolutions } from './goals';
import {
  EXERCISE_TYPES,
  LESSON_SIZES,
  TEXT_LANGUAGES,
  type Goal,
  type Language,
  type Lesson,
  type LessonError,
  type LessonSize,
  type ValidationContext,
  type ValidationResult,
} from './schema';

export const MAX_ERRORS = 50;

const LESSON_ID = /^u\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;
const EXERCISE_ID = /^[a-z0-9-]+$/;
const VERTEX = /^[a-z][1-9][0-9]?$/;
const COLUMNS = 'abcdefghjklmnopqrst';

type Json = Record<string, unknown>;

class Report {
  readonly errors: LessonError[] = [];
  add(code: string, path: string, message: string): void {
    if (this.errors.length < MAX_ERRORS) this.errors.push({ code, path, message });
  }
}

function join(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`;
  return path === '' ? key : `${path}.${key}`;
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates one lesson file. Without `ctx.hasText` the text-key rules are skipped. */
export function validateLesson(input: unknown, ctx: ValidationContext = {}): ValidationResult {
  if (!isObject(input)) {
    return {
      ok: false,
      errors: [{ code: 'NOT_OBJECT', path: '', message: 'lesson must be a JSON object' }],
    };
  }
  const v = new Validator(new Report(), ctx);
  v.lesson(input);
  const { errors } = v.report;
  return errors.length === 0
    ? { ok: true, lesson: input as unknown as Lesson }
    : { ok: false, errors };
}

/** Rules across lessons: unique ids, one lesson and at most one checkpoint per unit. */
export function validateCatalog(
  lessons: readonly Lesson[],
): { ok: true } | { ok: false; errors: LessonError[] } {
  const report = new Report();
  const seen = new Set<string>();
  lessons.forEach((lesson, i) => {
    if (seen.has(lesson.id)) {
      report.add('DUPLICATE_LESSON', `[${i}].id`, `lesson id "${lesson.id}" is used twice`);
    }
    seen.add(lesson.id);
  });

  const units = [...new Set(lessons.map((l) => l.unit))].sort((a, b) => a - b);
  for (const unit of units) {
    const inUnit = lessons.filter((l) => l.unit === unit);
    const lessonCount = inUnit.filter((l) => l.kind === 'lesson').length;
    const checkpoints = inUnit.filter((l) => l.kind === 'checkpoint');
    if (lessonCount === 0) {
      for (const checkpoint of checkpoints) {
        report.add(
          'CHECKPOINT_ORDER',
          `unit ${unit}`,
          `checkpoint "${checkpoint.id}" needs a lesson in unit ${unit}`,
        );
      }
    }
    if (lessonCount > 1 || checkpoints.length > 1) {
      report.add(
        'UNIT_LESSON_COUNT',
        `unit ${unit}`,
        `unit ${unit} must have exactly one lesson and at most one checkpoint`,
      );
    }
  }
  return report.errors.length === 0 ? { ok: true } : { ok: false, errors: report.errors };
}

class Validator {
  constructor(
    readonly report: Report,
    readonly ctx: ValidationContext,
  ) {}

  private add(code: string, path: string, message: string) {
    this.report.add(code, path, message);
  }

  // ---- generic shape helpers ----

  /** Reports unknown and missing fields. */
  private fields(obj: Json, path: string, required: string[], optional: string[]) {
    const allowed = new Set([...required, ...optional]);
    for (const key of Object.keys(obj)) {
      if (!allowed.has(key))
        this.add('UNKNOWN_FIELD', join(path, key), `unknown field "${key}" (typo?)`);
    }
    for (const key of required) {
      if (!(key in obj)) this.add('MISSING_FIELD', join(path, key), `"${key}" is required`);
    }
  }

  private badType(path: string, name: string, expected: string) {
    this.add('BAD_TYPE', path, `"${name}" must be ${expected}`);
  }

  private object(value: unknown, path: string, name: string): Json | null {
    if (isObject(value)) return value;
    this.badType(path, name, 'an object');
    return null;
  }

  private array(value: unknown, path: string, name: string): unknown[] | null {
    if (Array.isArray(value)) return value;
    this.badType(path, name, 'an array');
    return null;
  }

  private text(value: unknown, path: string, name: string): void {
    if (typeof value !== 'string' || value.length === 0) {
      this.badType(path, name, 'a non-empty string');
      return;
    }
    const { hasText } = this.ctx;
    if (!hasText) return;
    const missing = TEXT_LANGUAGES.filter((lang: Language) => !hasText(value, lang));
    if (missing.length > 0) {
      this.add('MISSING_TEXT', path, `text "${value}" is missing in: ${missing.join(', ')}`);
    }
  }

  private optionalText(obj: Json, key: string, path: string) {
    if (key in obj) this.text(obj[key], join(path, key), key);
  }

  /** A vertex on a board of `size`, or null (error reported). */
  private vertex(value: unknown, path: string, size: LessonSize): Vertex | null {
    if (typeof value === 'string' && VERTEX.test(value)) {
      try {
        parseVertex(value, size);
        return value;
      } catch {
        // reported below
      }
    }
    const last = COLUMNS[size - 1];
    this.add(
      'BAD_VERTEX',
      path,
      `"${String(value)}" is not a point on a ${size}×${size} board (columns a–${last}, no "i"; rows 1–${size})`,
    );
    return null;
  }

  private vertices(value: unknown, path: string, name: string, size: LessonSize): Vertex[] | null {
    const list = this.array(value, path, name);
    if (!list) return null;
    const out = list.map((item, i) => this.vertex(item, join(path, i), size));
    return out.every((x): x is Vertex => x !== null) ? out : null;
  }

  // ---- lesson ----

  lesson(obj: Json) {
    this.fields(
      obj,
      '',
      ['schema', 'id', 'unit', 'kind', 'titleKey', 'exercises'],
      ['coordinates', 'explain'],
    );

    if ('schema' in obj && obj.schema !== 1) {
      this.add(
        'BAD_SCHEMA',
        'schema',
        `unsupported schema version ${String(obj.schema)}; expected 1`,
      );
    }

    const unitOk =
      'unit' in obj &&
      Number.isInteger(obj.unit) &&
      (obj.unit as number) >= 0 &&
      (obj.unit as number) <= 16;
    if ('unit' in obj && !unitOk)
      this.add('BAD_UNIT', 'unit', 'unit must be an integer from 0 to 16');

    if ('id' in obj) {
      const id = obj.id;
      if (typeof id !== 'string' || !LESSON_ID.test(id)) {
        this.add('BAD_ID', 'id', `id "${String(id)}" must look like "u04-capture"`);
      } else if (unitOk) {
        const prefix = `u${String(obj.unit).padStart(2, '0')}`;
        if (!id.startsWith(`${prefix}-`)) {
          this.add(
            'ID_UNIT_MISMATCH',
            'id',
            `id "${id}" must start with "${prefix}" to match unit ${String(obj.unit)}`,
          );
        }
      }
    }

    const kindOk = obj.kind === 'lesson' || obj.kind === 'checkpoint';
    if ('kind' in obj && !kindOk)
      this.add('BAD_KIND', 'kind', 'kind must be "lesson" or "checkpoint"');

    if ('titleKey' in obj) this.text(obj.titleKey, 'titleKey', 'titleKey');
    if ('coordinates' in obj && typeof obj.coordinates !== 'boolean') {
      this.badType('coordinates', 'coordinates', 'true or false');
    }

    this.explain(obj, kindOk ? (obj.kind as Lesson['kind']) : null);

    if ('exercises' in obj) {
      const exercises = this.array(obj.exercises, 'exercises', 'exercises');
      if (exercises) {
        if (exercises.length < 5 || exercises.length > 10) {
          this.add(
            'BAD_EXERCISE_COUNT',
            'exercises',
            `exercises must have 5 to 10 items, found ${exercises.length}`,
          );
        }
        const ids = new Set<string>();
        exercises.forEach((item, i) => {
          const path = join('exercises', i);
          const ex = this.object(item, path, path);
          if (!ex) return;
          if (typeof ex.id === 'string') {
            if (ids.has(ex.id))
              this.add('DUPLICATE_ID', join(path, 'id'), `exercise id "${ex.id}" is used twice`);
            ids.add(ex.id);
          }
          this.exercise(ex, path);
        });
      }
    }
  }

  // ---- explanation steps ----

  private explain(obj: Json, kind: Lesson['kind'] | null) {
    const raw = obj.explain;
    if (raw === undefined) {
      if (kind === 'lesson')
        this.add('BAD_STEP_COUNT', 'explain', 'explain must have 2 to 4 steps, found 0');
      return;
    }
    const steps = this.array(raw, 'explain', 'explain');
    if (!steps) return;
    if (kind === 'lesson' && (steps.length < 2 || steps.length > 4)) {
      this.add(
        'BAD_STEP_COUNT',
        'explain',
        `explain must have 2 to 4 steps, found ${steps.length}`,
      );
    }
    if (kind === 'checkpoint' && steps.length > 0) {
      this.add('BAD_STEP_COUNT', 'explain', 'a checkpoint has no explain steps');
    }

    /** End position of the previous step; null when it could not be built. */
    let current: GameState | null = null;
    steps.forEach((item, i) => {
      const path = join('explain', i);
      const step = this.object(item, path, path);
      if (!step) {
        current = null;
        return;
      }
      this.fields(step, path, ['textKey'], ['board', 'moves', 'highlights', 'markers']);
      if ('textKey' in step) this.text(step.textKey, join(path, 'textKey'), 'textKey');

      if ('board' in step) {
        const board = this.object(step.board, join(path, 'board'), 'board');
        current = board ? this.position(board, join(path, 'board'), ['size', 'setup'], []) : null;
      } else if (i === 0) {
        this.add('STEP_NO_BOARD', path, 'the first explain step needs a "board"');
        current = null;
      }

      const size = current?.board.size as LessonSize | undefined;
      if ('highlights' in step && size)
        this.highlights(step.highlights, join(path, 'highlights'), size);
      if ('markers' in step && size) this.markers(step.markers, join(path, 'markers'), size);
      if ('moves' in step) current = this.moves(step.moves, join(path, 'moves'), current);
    });
  }

  private moves(value: unknown, path: string, start: GameState | null): GameState | null {
    const list = this.array(value, path, 'moves');
    if (!list) return null;
    let state = start;
    list.forEach((item, i) => {
      const movePath = join(path, i);
      const move = this.object(item, movePath, 'move');
      if (!move) {
        state = null;
        return;
      }
      this.fields(move, movePath, ['color', 'at'], []);
      const color = move.color;
      if ('color' in move && color !== 'B' && color !== 'W')
        this.badType(join(movePath, 'color'), 'color', '"B" or "W"');
      if (!state || !('at' in move) || (color !== 'B' && color !== 'W')) {
        state = null;
        return;
      }
      const at = this.vertex(move.at, join(movePath, 'at'), state.board.size as LessonSize);
      if (!at) {
        state = null;
        return;
      }
      const result = playAs(state, color, at);
      if (!result.ok) {
        this.add('MOVE_ILLEGAL', movePath, `move ${color} ${at} is illegal here: ${result.reason}`);
        state = null;
        return;
      }
      state = result.state;
    });
    return state;
  }

  private highlights(value: unknown, path: string, size: LessonSize) {
    const list = this.array(value, path, 'highlights');
    list?.forEach((item, i) => {
      const p = join(path, i);
      const h = this.object(item, p, 'highlight');
      if (!h) return;
      this.fields(h, p, ['kind', 'points'], []);
      if ('kind' in h && !['liberty', 'hint', 'success', 'error'].includes(h.kind as string)) {
        this.badType(join(p, 'kind'), 'kind', 'one of "liberty", "hint", "success", "error"');
      }
      if ('points' in h) this.vertices(h.points, join(p, 'points'), 'points', size);
    });
  }

  private markers(value: unknown, path: string, size: LessonSize) {
    const list = this.array(value, path, 'markers');
    list?.forEach((item, i) => {
      const p = join(path, i);
      const m = this.object(item, p, 'marker');
      if (!m) return;
      const isLabel = m.kind === 'label';
      this.fields(m, p, isLabel ? ['kind', 'at', 'text'] : ['kind', 'at'], []);
      if (
        'kind' in m &&
        !['circle', 'triangle', 'square', 'cross', 'label'].includes(m.kind as string)
      ) {
        this.badType(
          join(p, 'kind'),
          'kind',
          'one of "circle", "triangle", "square", "cross", "label"',
        );
      }
      if ('at' in m) this.vertex(m.at, join(p, 'at'), size);
      if (isLabel && 'text' in m) {
        const n = typeof m.text === 'string' ? [...m.text].length : 0;
        if (typeof m.text !== 'string' || m.text.trim() === '' || n > 2) {
          this.add('BAD_LABEL', join(p, 'text'), 'label text must be 1–2 characters');
        }
      }
    });
  }

  /**
   * Checks `size` and `setup` of a board or exercise and returns its starting game (Black to
   * play), or null when the position is not valid.
   */
  private position(
    obj: Json,
    path: string,
    required: string[],
    optional: string[],
  ): GameState | null {
    this.fields(obj, path, required, optional);
    if (!('size' in obj)) return null;
    const size = obj.size;
    if (!LESSON_SIZES.includes(size as LessonSize)) {
      this.add(
        'BAD_SIZE',
        join(path, 'size'),
        `board size ${String(size)} is not supported (use 5, 7 or 9)`,
      );
      return null;
    }
    if (!('setup' in obj)) return null;
    return this.setup(obj.setup, join(path, 'setup'), size as LessonSize);
  }

  private setup(value: unknown, path: string, size: LessonSize): GameState | null {
    const setup = this.object(value, path, 'setup');
    if (!setup) return null;
    this.fields(setup, path, [], ['B', 'W']);
    let ok = true;
    const seen = new Set<string>();
    const stones: Record<Color, Vertex[]> = { B: [], W: [] };
    for (const color of ['B', 'W'] as const) {
      if (!(color in setup)) continue;
      const list = this.array(setup[color], join(path, color), color);
      if (!list) {
        ok = false;
        continue;
      }
      list.forEach((item, i) => {
        const at = this.vertex(item, join(join(path, color), i), size);
        if (!at) {
          ok = false;
          return;
        }
        if (seen.has(at)) {
          this.add(
            'SETUP_OVERLAP',
            join(join(path, color), i),
            `"${at}" appears more than once in the setup`,
          );
          ok = false;
          return;
        }
        seen.add(at);
        stones[color].push(at);
      });
    }
    if (!ok) return null;

    // Every setup group needs a liberty; report each dead group once, at its first stone.
    const board = boardWith(size, stones);
    const reported = new Set<string>();
    let dead = false;
    for (const at of [...stones.B, ...stones.W]) {
      if (reported.has(at)) continue;
      const group = groupAt(board, at);
      if (!group) continue;
      group.stones.forEach((p) => reported.add(toVertex(p, size)));
      if (group.liberties.length === 0) {
        this.add(
          'SETUP_DEAD_GROUP',
          path,
          `the stones around "${at}" have no liberties in the starting position`,
        );
        dead = true;
      }
    }
    return dead ? null : createGame(size, { setup: stones });
  }

  // ---- exercises ----

  private exercise(ex: Json, path: string) {
    const type = ex.type;
    if (!('type' in ex)) {
      this.add('MISSING_FIELD', join(path, 'type'), '"type" is required');
      return;
    }
    if (!EXERCISE_TYPES.includes(type as never)) {
      this.add('UNKNOWN_TYPE', join(path, 'type'), `unknown exercise type "${String(type)}"`);
      return;
    }

    const base = ['id', 'type', 'size', 'setup', 'promptKey'];
    const baseOptional = ['hintKey', 'hintPoints', 'explainKey', 'markers'];
    const specific: Record<string, string[]> = {
      'tap-point': ['mode', 'answer'],
      'play-move': ['toPlay', 'goal'],
      choice: ['options'],
      count: ['answer'],
    };
    const state = this.position(ex, path, [...base, ...specific[type as string]], baseOptional);

    if ('id' in ex && (typeof ex.id !== 'string' || !EXERCISE_ID.test(ex.id))) {
      this.add(
        'BAD_ID',
        join(path, 'id'),
        `exercise id "${String(ex.id)}" must use only a–z, 0–9 and "-"`,
      );
    }
    if ('promptKey' in ex) this.text(ex.promptKey, join(path, 'promptKey'), 'promptKey');
    this.optionalText(ex, 'hintKey', path);
    this.optionalText(ex, 'explainKey', path);

    const size = state?.board.size as LessonSize | undefined;
    if ('markers' in ex && size) this.markers(ex.markers, join(path, 'markers'), size);
    const hintPoints =
      'hintPoints' in ex && size
        ? this.vertices(ex.hintPoints, join(path, 'hintPoints'), 'hintPoints', size)
        : null;

    let solution: Vertex[] | null = null;
    switch (type) {
      case 'tap-point':
        solution = this.tapPoint(ex, path, state);
        break;
      case 'play-move':
        solution = this.playMove(ex, path, state);
        break;
      case 'choice':
        this.choice(ex, path);
        break;
      case 'count':
        solution = this.count(ex, path, state);
        break;
    }

    if (hintPoints && solution && solution.length > 0) {
      const outside = hintPoints.filter((p) => !solution.includes(p));
      if (outside.length > 0) {
        this.add(
          'BAD_HINT',
          join(path, 'hintPoints'),
          `hintPoints must be among the solution points ${solution.join(', ')}`,
        );
      }
    }
  }

  /** A stone vertex for `libertiesOf`-style answers, or null (error reported). */
  private target(value: unknown, path: string, state: GameState): Vertex | null {
    const at = this.vertex(value, path, state.board.size as LessonSize);
    if (!at) return null;
    if (!groupAt(state.board, at)) {
      this.add('TARGET_NOT_STONE', path, `"${at}" must be a stone`);
      return null;
    }
    return at;
  }

  private tapPoint(ex: Json, path: string, state: GameState | null): Vertex[] | null {
    if ('mode' in ex && ex.mode !== 'one' && ex.mode !== 'all')
      this.badType(join(path, 'mode'), 'mode', '"one" or "all"');
    if (!('answer' in ex)) return null;
    const answerPath = join(path, 'answer');
    const answer = this.object(ex.answer, answerPath, 'answer');
    if (!answer) return null;
    if ('libertiesOf' in answer) {
      this.fields(answer, answerPath, ['libertiesOf'], []);
      if (!state) return null;
      const at = this.target(answer.libertiesOf, join(answerPath, 'libertiesOf'), state);
      if (!at) return null;
      const libs = libertyVertices(state, at) ?? [];
      if (libs.length === 0) this.add('EMPTY_ANSWER', answerPath, 'answer has no points');
      return libs;
    }
    this.fields(answer, answerPath, ['points'], []);
    if (!('points' in answer) || !state) return null;
    const points = this.vertices(
      answer.points,
      join(answerPath, 'points'),
      'points',
      state.board.size as LessonSize,
    );
    if (points && points.length === 0)
      this.add('EMPTY_ANSWER', join(answerPath, 'points'), 'answer has no points');
    return points;
  }

  private playMove(ex: Json, path: string, state: GameState | null): Vertex[] | null {
    const toPlay = ex.toPlay;
    const colorOk = toPlay === 'B' || toPlay === 'W';
    if ('toPlay' in ex && !colorOk) this.badType(join(path, 'toPlay'), 'toPlay', '"B" or "W"');
    if (!('goal' in ex)) return null;
    const goalPath = join(path, 'goal');
    const goal = this.object(ex.goal, goalPath, 'goal');
    if (!goal) return null;

    const shapes: Record<string, string[]> = {
      point: ['points'],
      capture: [],
      atari: [],
      connect: ['a', 'b'],
      save: ['target'],
    };
    const kind = goal.kind;
    if (typeof kind !== 'string' || !(kind in shapes)) {
      if (!('kind' in goal))
        this.add('MISSING_FIELD', join(goalPath, 'kind'), '"kind" is required');
      else
        this.badType(
          join(goalPath, 'kind'),
          'kind',
          'one of "point", "capture", "atari", "connect", "save"',
        );
      return null;
    }
    this.fields(goal, goalPath, ['kind', ...shapes[kind]], kind === 'capture' ? ['min'] : []);
    if (
      kind === 'capture' &&
      'min' in goal &&
      !(Number.isInteger(goal.min) && (goal.min as number) >= 1)
    ) {
      this.badType(join(goalPath, 'min'), 'min', 'an integer of at least 1');
      return null;
    }
    if (!state || !colorOk || !shapes[kind].every((k) => k in goal)) return null;

    const game = withTurn(state, toPlay);
    const size = state.board.size as LessonSize;

    if (kind === 'point') {
      const points = this.vertices(goal.points, join(goalPath, 'points'), 'points', size);
      if (!points) return null;
      if (points.length === 0) {
        this.add('EMPTY_ANSWER', join(goalPath, 'points'), 'answer has no points');
        return null;
      }
      let ok = true;
      points.forEach((p, i) => {
        if (!isLegalMove(game, p)) {
          this.add(
            'GOAL_POINT_ILLEGAL',
            join(join(goalPath, 'points'), i),
            `goal point "${p}" is not a legal move`,
          );
          ok = false;
        }
      });
      if (!ok) return null;
    }

    if (kind === 'connect') {
      const a = this.target(goal.a, join(goalPath, 'a'), state);
      const b = this.target(goal.b, join(goalPath, 'b'), state);
      if (!a || !b) return null;
      const groupA = groupAt(state.board, a);
      const groupB = groupAt(state.board, b);
      if (groupA?.color !== groupB?.color) {
        this.add('GOAL_SAME_COLOR', goalPath, `"${a}" and "${b}" must be the same colour`);
        return null;
      }
      if (groupA?.stones.some((p) => toVertex(p, size) === b)) {
        this.add(
          'ALREADY_TRUE',
          goalPath,
          `goal "connect" is already true in the starting position`,
        );
        return null;
      }
    }

    if (kind === 'save') {
      const target = this.target(goal.target, join(goalPath, 'target'), state);
      if (!target) return null;
      const group = groupAt(state.board, target);
      if (group?.color !== toPlay) {
        this.add(
          'GOAL_SAME_COLOR',
          join(goalPath, 'target'),
          `"${target}" must be a ${toPlay} stone`,
        );
        return null;
      }
      if (group.liberties.length >= 2) {
        this.add('ALREADY_TRUE', goalPath, `goal "save" is already true in the starting position`);
        return null;
      }
    }

    const solutions = playMoveSolutions(game, goal as unknown as Goal);
    if (solutions.length === 0) {
      this.add('NO_SOLUTION', goalPath, `no legal move for ${toPlay} meets goal "${kind}"`);
      return null;
    }
    return solutions;
  }

  private choice(ex: Json, path: string) {
    if (!('options' in ex)) return;
    const optionsPath = join(path, 'options');
    const options = this.array(ex.options, optionsPath, 'options');
    if (!options) return;
    if (options.length < 2 || options.length > 4) {
      this.add(
        'BAD_OPTION_COUNT',
        optionsPath,
        `a choice needs 2 to 4 options, found ${options.length}`,
      );
    }
    let correct = 0;
    options.forEach((item, i) => {
      const p = join(optionsPath, i);
      const option = this.object(item, p, 'option');
      if (!option) return;
      this.fields(option, p, ['textKey'], ['correct', 'whyKey']);
      if ('textKey' in option) this.text(option.textKey, join(p, 'textKey'), 'textKey');
      this.optionalText(option, 'whyKey', p);
      if ('correct' in option && typeof option.correct !== 'boolean')
        this.badType(join(p, 'correct'), 'correct', 'true or false');
      if (option.correct === true) correct++;
    });
    if (correct !== 1) {
      this.add(
        'BAD_CORRECT_COUNT',
        optionsPath,
        `exactly one option must have "correct": true, found ${correct}`,
      );
    }
  }

  private count(ex: Json, path: string, state: GameState | null): Vertex[] | null {
    if (!('answer' in ex)) return null;
    const answerPath = join(path, 'answer');
    const answer = ex.answer;
    const badCount = (n: unknown) =>
      this.add(
        'BAD_COUNT_ANSWER',
        answerPath,
        `count answer must be an integer from 0 to 9, got ${String(n)}`,
      );
    if (typeof answer === 'number') {
      if (!Number.isInteger(answer) || answer < 0 || answer > 9) badCount(answer);
      return null;
    }
    const obj = this.object(answer, answerPath, 'answer');
    if (!obj) return null;
    this.fields(obj, answerPath, ['libertiesOf'], []);
    if (!state || !('libertiesOf' in obj)) return null;
    const at = this.target(obj.libertiesOf, join(answerPath, 'libertiesOf'), state);
    if (!at) return null;
    const libs = libertyVertices(state, at) ?? [];
    if (libs.length > 9) badCount(libs.length);
    return libs;
  }
}

/** The same position with `color` to play (no ko ban carried over when the turn is forced). */
function withTurn(state: GameState, color: Color): GameState {
  return state.toPlay === color ? state : { ...state, toPlay: color, koPoint: null };
}

function boardWith(size: LessonSize, stones: Record<Color, Vertex[]>) {
  // createGame would throw on a dead group, so place stones without the liberty check.
  const cells: (Color | null)[] = new Array(size * size).fill(null);
  for (const color of ['B', 'W'] as const) {
    for (const at of stones[color]) {
      const p = parseVertex(at, size);
      cells[p.y * size + p.x] = color;
    }
  }
  return { size, cells } as const;
}
