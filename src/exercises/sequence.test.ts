// The pure sequence judge (spec docs/specs/M5-life-death.md AC 15–21, 23, 26, 35, 38). No timers.
import { parseVertex, toVertex, type BoardSize, type Point } from '@/engine';
import { position } from '@/lessons/__fixtures__/fixtures';
import { LESSON_FILES } from '@/lessons/registry';
import type { Lesson, SequenceExercise } from '@/lessons';

import {
  advance,
  answerStones,
  capturedSince,
  expectedPoint,
  judgeSequence,
  learnerMoveCount,
  moveNumber,
  positionAfter,
  recoveryOf,
  sequenceStart,
  type SequenceProgress,
} from './sequence';

const lessons = LESSON_FILES as readonly Lesson[];
const shipped = (lessonId: string, id: string) =>
  lessons.find((l) => l.id === lessonId)!.exercises.find((e) => e.id === id) as SequenceExercise;

/**
 * kill-straight (u11-vital v2): White b1, Black a1, White c1 captures 6.
 *   5 . . . . .
 *   4 . . . . .
 *   3 O O O O O
 *   2 X X X X O
 *   1 . . . X O
 */
const KILL = shipped('u11-vital', 'kill-straight');

const B = (at: string) => ({ color: 'B' as const, at });
const W = (at: string) => ({ color: 'W' as const, at });

/** A 4-ply line (even length): the learner's 2nd move is answered, then the problem is solved. */
const EVEN: SequenceExercise = {
  id: 'even',
  type: 'sequence',
  ...position(`
    . . . . .
    . . . . .
    . X O . .
    . . X X .
    . . . . .
  `),
  toPlay: 'B',
  goal: { kind: 'line' },
  line: [B('c4'), W('d3'), B('e3'), W('d4')],
  promptKey: 'p',
};

/**
 * Prelude with a ko: Black c3 captures c4, so White may not retake at c4 at once.
 *   5 . . X . .
 *   4 . X O X .
 *   3 . O . O .
 *   2 . . O . .
 *   1 . . . . .
 */
const KO: SequenceExercise = {
  id: 'ko',
  type: 'sequence',
  ...position(`
    . . X . .
    . X O X .
    . O . O .
    . . O . .
    . . . . .
  `),
  prelude: [B('c3')],
  toPlay: 'W',
  goal: { kind: 'line' },
  line: [W('a1'), B('e1'), W('a2')],
  promptKey: 'p',
};

const pt = (v: string, size: BoardSize = 5): Point => parseVertex(v, size);
const v = (p: Point, size: BoardSize = 5) => toVertex(p, size);

/** Plays the line's learner moves up to (not including) learner move `n` (0-based). */
function after(exercise: SequenceExercise, n: number): SequenceProgress {
  let progress = sequenceStart(exercise);
  for (let i = 0; i < n; i++) {
    const j = judgeSequence(exercise, progress, pt(exercise.line[progress.ply].at, exercise.size));
    if (j.kind !== 'next') throw new Error(`expected next, got ${j.kind}`);
    progress = advance(progress, j);
  }
  return progress;
}

describe('start and counters (AC 14, 26)', () => {
  it('m = ceil(line / 2); progress starts at Move 1', () => {
    expect(learnerMoveCount(KILL)).toBe(2);
    expect(learnerMoveCount(EVEN)).toBe(2);
    expect(moveNumber(KILL, 0)).toBe(1);
    expect(moveNumber(KILL, 2)).toBe(2);
    expect(moveNumber(KILL, 4)).toBe(2);
  });

  it('starts from the setup with toPlay to move', () => {
    const start = sequenceStart(KILL);
    expect(start.ply).toBe(0);
    expect(start.state.toPlay).toBe('W');
    expect(start.state.moves).toEqual([]);
  });

  it('AC 26: a prelude is played first and its ko ban holds', () => {
    const start = sequenceStart(KO);
    expect(start.state.toPlay).toBe('W');
    expect(start.state.board.cells[pt('c4').y * 5 + pt('c4').x]).toBeNull();
    expect(judgeSequence(KO, start, pt('c4'))).toEqual({ kind: 'illegal', reason: 'ko' });
    expect(judgeSequence(KO, start, pt('a1')).kind).toBe('next');
  });

  it('AC 27: the expected point follows the ply', () => {
    expect(expectedPoint(KILL, 0)).toBe('b1');
    expect(expectedPoint(KILL, 2)).toBe('c1');
    expect(expectedPoint(KILL, 4)).toBeNull();
  });
});

describe('on the line (AC 15, 16, 38)', () => {
  it('AC 15: the right move gets the scripted reply and the progress moves on', () => {
    const start = sequenceStart(KILL);
    const j = judgeSequence(KILL, start, pt('b1'));
    expect(j.kind).toBe('next');
    if (j.kind !== 'next') return;
    expect(v(j.move.point)).toBe('b1');
    expect(j.move.color).toBe('W');
    expect(j.replies.map((r) => [r.color, v(r.point)])).toEqual([['B', 'a1']]);
    const progress = advance(start, j);
    expect(progress.ply).toBe(2);
    expect(progress.state.toPlay).toBe('W');
    expect(moveNumber(KILL, progress.ply)).toBe(2);
  });

  it('AC 16, 38: the last learner move solves it, captures 6 and has no stray reply', () => {
    const progress = after(KILL, 1);
    const j = judgeSequence(KILL, progress, pt('c1'));
    expect(j.kind).toBe('solved');
    if (j.kind === 'illegal') return;
    expect(j.replies).toEqual([]);
    expect(j.move.facts.captured.flat()).toHaveLength(6);
    const start = sequenceStart(KILL).state;
    expect(capturedSince(start, positionAfter(j), 'W')).toBe(6);
  });

  it("AC 16: an even line ends with the opponent's last scripted move", () => {
    const progress = after(EVEN, 1);
    const j = judgeSequence(EVEN, progress, pt('e3'));
    expect(j.kind).toBe('solved');
    if (j.kind === 'illegal') return;
    expect(j.replies.map((r) => v(r.point))).toEqual(['d4']);
  });
});

describe('mistakes (AC 17–21)', () => {
  it('AC 17: an occupied point is illegal (no try lost, nothing placed)', () => {
    expect(judgeSequence(KILL, sequenceStart(KILL), pt('a2'))).toEqual({
      kind: 'illegal',
      reason: 'occupied',
    });
  });

  it('AC 17: a suicide is illegal (White inside a real eye)', () => {
    const twoEyes: SequenceExercise = {
      ...KILL,
      setup: { ...KILL.setup, B: [...(KILL.setup.B ?? []), 'b1'] },
      goal: { kind: 'line' },
      line: [W('a5'), B('b5')],
      wrong: [],
    };
    expect(judgeSequence(twoEyes, sequenceStart(twoEyes), pt('a1'))).toEqual({
      kind: 'illegal',
      reason: 'suicide',
    });
  });

  it('AC 18: a listed wrong first move plays its refutation and shows its whyKey', () => {
    const j = judgeSequence(KILL, sequenceStart(KILL), pt('a1'));
    expect(j.kind).toBe('refuted');
    if (j.kind !== 'refuted') return;
    expect(j.replies.map((r) => [r.color, v(r.point)])).toEqual([['B', 'b1']]);
    expect(j.replies[0].facts.captured.flat().map((p) => v(p))).toEqual(['a1']);
    expect(j.lines).toEqual([{ key: 'lesson.u11-vital.v2.w1' }]);
    expect(recoveryOf(0, 'refuted')).toBe('restart');
  });

  it('AC 18: a wrong branch without whyKey uses sequence.wrong.refuted', () => {
    const exercise: SequenceExercise = { ...KILL, wrong: [{ line: [W('a1'), B('b1')] }] };
    const j = judgeSequence(exercise, sequenceStart(exercise), pt('a1'));
    expect(j.kind === 'refuted' && j.lines).toEqual([{ key: 'sequence.wrong.refuted' }]);
  });

  it('AC 19: a legal move off the line at ply 0: no reply; the liberty fact when ≥ 2 remain', () => {
    const j = judgeSequence(KILL, sequenceStart(KILL), pt('a5'));
    expect(j.kind).toBe('wrong');
    if (j.kind !== 'wrong') return;
    expect(j.replies).toEqual([]);
    expect(j.lines).toEqual([{ key: 'sequence.wrong.liberties', params: { count: 3 } }]);
    expect(recoveryOf(0, 'wrong')).toBe('restart');
  });

  it('AC 19: notLine for a goal other than capture', () => {
    const j = judgeSequence(EVEN, sequenceStart(EVEN), pt('a1'));
    expect(j.kind === 'wrong' && j.lines).toEqual([{ key: 'sequence.wrong.notLine' }]);
  });

  it('AC 19: notLine when the target has fewer than 2 liberties after the move', () => {
    // After White b1 / Black a1, the black group has the single liberty c1.
    const progress = after(KILL, 1);
    const j = judgeSequence(KILL, progress, pt('a5'));
    expect(j.kind === 'wrong' && j.lines).toEqual([{ key: 'sequence.wrong.notLine' }]);
  });

  it('AC 20: a wrong move at a later ply is undone (progress kept)', () => {
    const progress = after(KILL, 1);
    const j = judgeSequence(KILL, progress, pt('e5'));
    expect(j.kind).toBe('wrong');
    expect(recoveryOf(progress.ply, 'wrong')).toBe('undo');
    // Undo = keep `progress` (the position before the mistake): the right move still solves it.
    expect(judgeSequence(KILL, progress, pt('c1')).kind).toBe('solved');
  });

  it('AC 20: a later-ply move equal to a wrong branch start is judged off-line, not refuted', () => {
    const progress = after(EVEN, 1);
    const j = judgeSequence(EVEN, progress, pt('a1'));
    expect(j.kind).toBe('wrong');
  });

  it('AC 21: after a restart the start position is the same as at first', () => {
    expect(sequenceStart(KILL)).toEqual(sequenceStart(KILL));
  });
});

describe('the revealed answer (AC 23)', () => {
  it('plays the whole line from the start', () => {
    const stones = answerStones(KILL);
    expect(stones.map((s) => `${s.color} ${v(s.point)}`)).toEqual(['W b1', 'B a1', 'W c1']);
    expect(stones[2].facts.captured.flat()).toHaveLength(6);
  });

  it('starts after the prelude', () => {
    expect(answerStones(KO).map((s) => v(s.point))).toEqual(['a1', 'e1', 'a2']);
  });
});

describe('every shipped sequence is playable by the runner (AC 8)', () => {
  const all = lessons.flatMap((lesson) =>
    lesson.exercises
      .filter((e): e is SequenceExercise => e.type === 'sequence')
      .map((e) => [`${lesson.id}/${e.id}`, e] as const),
  );

  it('ships exactly kill-straight, kill-bent and r-kill (AC 3)', () => {
    expect(all.map(([name]) => name)).toEqual([
      'u11-vital/kill-straight',
      'u11-vital/kill-bent',
      'u11-review/r-kill',
    ]);
  });

  it.each(all)('%s: playing the line move by move solves it', (_name, exercise) => {
    let progress = sequenceStart(exercise);
    for (;;) {
      const at = expectedPoint(exercise, progress.ply)!;
      const j = judgeSequence(exercise, progress, pt(at, exercise.size));
      if (j.kind === 'solved') break;
      expect(j.kind).toBe('next');
      if (j.kind !== 'next') return;
      progress = advance(progress, j);
    }
  });

  it.each(all)('%s: every wrong branch is refuted with its whyKey', (_name, exercise) => {
    for (const branch of exercise.wrong ?? []) {
      const j = judgeSequence(exercise, sequenceStart(exercise), pt(branch.line[0].at));
      expect(j.kind).toBe('refuted');
      expect(j.kind === 'refuted' && j.lines[0].key).toBe(branch.whyKey);
    }
  });
});

describe('purity (AC 35)', () => {
  it('sequence.ts and engineAdapter.ts import nothing from React, React Native or Expo', () => {
    const { readFileSync } = jest.requireActual<typeof import('node:fs')>('node:fs');
    const { join } = jest.requireActual<typeof import('node:path')>('node:path');
    for (const file of ['sequence.ts', 'engineAdapter.ts']) {
      const code = readFileSync(join(__dirname, file), 'utf8');
      const imports = [...code.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]);
      expect({
        file,
        ui: imports.filter((m) => /^(react|react-native|expo|@expo\/)/.test(m)),
      }).toEqual({
        file,
        ui: [],
      });
    }
  });
});
