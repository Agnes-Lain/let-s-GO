// Sequence v2: search-judged ladders (spec docs/specs/M5-sequence-v2.md AC 11–12, 14–28).
import { judgeAttack } from '@/bot';
import { legalMoves, parseVertex, toVertex, type BoardSize, type GameState } from '@/engine';
import {
  advance,
  capturedSince,
  hintPoint,
  judgeSequence,
  learnerMoveCount,
  moveNumber,
  sequenceStart,
  type SequenceProgress,
} from '@/exercises/sequence';
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zh from '@/i18n/zh-CN.json';
import {
  STAR_RULES,
  computeStars,
  validateLesson,
  type Lesson,
  type SequenceExercise,
} from '@/lessons';
import { LESSON_FILES } from '@/lessons/registry';

const lessons = LESSON_FILES as readonly Lesson[];
const byId = (id: string) => lessons.find((l) => l.id === id)!;
const shipped = (lessonId: string, id: string) =>
  byId(lessonId).exercises.find((e) => e.id === id) as SequenceExercise;

const LADDER = shipped('u09-ladder', 'ladder-play');
const CORNER = shipped('u09-ladder', 'ladder-play-corner');
const REVIEW = shipped('u09-review', 'r-ladder-play');
const ALL = [LADDER, CORNER, REVIEW];

const pt = (ex: SequenceExercise, v: string) => parseVertex(v, ex.size as BoardSize);
const vx = (state: GameState, p: { x: number; y: number }) =>
  toVertex(p, state.board.size as BoardSize);

/** Plays learner moves through the judge; every one must be accepted (next). */
function after(ex: SequenceExercise, moves: string[]): SequenceProgress {
  let progress = sequenceStart(ex);
  for (const at of moves) {
    const j = judgeSequence(ex, progress, pt(ex, at));
    if (j.kind !== 'next') throw new Error(`${ex.id}: ${at} gave ${j.kind}`);
    progress = advance(progress, j);
  }
  return progress;
}

/** Every legal point the judge accepts (next or solved) at `progress`, sorted. */
function accepted(ex: SequenceExercise, progress: SequenceProgress): string[] {
  return legalMoves(progress.state)
    .filter((p) => {
      const kind = judgeSequence(ex, progress, p).kind;
      return kind === 'next' || kind === 'solved';
    })
    .map((p) => vx(progress.state, p))
    .sort();
}

describe('D. content (AC 25, 26, 28)', () => {
  it('AC 25: u09-ladder has 9 exercises in the spec order', () => {
    expect(byId('u09-ladder').exercises.map((e) => e.id)).toEqual([
      'liberties-after',
      'first-atari',
      'chase-on',
      'finish',
      'ladder-play',
      'ladder-breaker',
      'find-breaker',
      'corner-ladder',
      'ladder-play-corner',
    ]);
  });

  it('AC 25: u09-review has 9 exercises, the last is r-ladder-play', () => {
    const ids = byId('u09-review').exercises.map((e) => e.id);
    expect(ids).toHaveLength(9);
    expect(ids[8]).toBe('r-ladder-play');
  });

  it.each(ALL.map((e) => [e.id, e] as const))(
    'AC 25–26: %s is a search-judged sequence with prompt, hint, hint point, explanation',
    (_id, ex) => {
      expect(ex.type).toBe('sequence');
      expect(ex.judge).toEqual({ kind: 'search', opponent: 'run' });
      expect(ex.wrong).toBeUndefined();
      expect(ex.hintPoints).toEqual([ex.line[0].at]);
      for (const key of [ex.promptKey, ex.hintKey!, ex.explainKey!]) {
        for (const [lang, file, limit] of [
          ['zh-CN', zh, 70],
          ['en', en, 160],
          ['fr', fr, 160],
        ] as const) {
          const text = (file as Record<string, string>)[key];
          expect({ key, lang, ok: typeof text === 'string' && [...text].length <= limit }).toEqual({
            key,
            lang,
            ok: true,
          });
        }
      }
    },
  );

  it('AC 26: the five new sequence.wrong keys exist in every language with plural suffixes', () => {
    const keys = [
      'sequence.wrong.atariButEscapes',
      'sequence.wrong.afterReply_one',
      'sequence.wrong.afterReply_other',
      'sequence.wrong.chaserCaptured_one',
      'sequence.wrong.chaserCaptured_other',
    ];
    for (const file of [zh, en, fr] as Record<string, string>[]) {
      for (const key of keys)
        expect({ key, text: typeof file[key] }).toEqual({ key, text: 'string' });
    }
    // Never names a colour (the opponent may be either).
    for (const key of keys) {
      expect((en as Record<string, string>)[key]).not.toMatch(/White|Black/);
      expect((zh as Record<string, string>)[key]).not.toMatch(/白|黑/);
      expect((fr as Record<string, string>)[key]).not.toMatch(/Blanc|Noir/);
    }
  });

  it('AC 28: Unit 9 and the review score with the unchanged star rules', () => {
    expect(STAR_RULES).toEqual({ threeClean: 0.8, twoSolved: 0.8, oneSolved: 0.5 });
    const nine = Array.from({ length: 9 }, () => 'clean' as const);
    expect(computeStars(nine)).toBe(3);
    expect(computeStars([...nine.slice(0, 7), 'solved', 'solved'])).toBe(2);
    expect(computeStars([...nine.slice(0, 7), 'revealed', 'revealed'])).toBe(1);
  });

  it('AC 11–12: both lessons validate (proofs included) in under 2 s', () => {
    const start = Date.now();
    for (const id of ['u09-ladder', 'u09-review']) {
      const result = validateLesson(byId(id), {});
      expect(result.ok ? [] : result.errors).toEqual([]);
    }
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe('AC 27: accepted moves, per position (along the line and the branches)', () => {
  // [exercise, learner moves so far, accepted set]. §9b: the net move (e4 / g6 / e2) is also
  // accepted at move 2: it captures in the same 4 moves.
  const table: [SequenceExercise, string[], string[]][] = [
    [LADDER, [], ['c4']],
    [LADDER, ['c4'], ['d4', 'e3', 'e4']],
    [LADDER, ['c4', 'e3'], ['d5']],
    [LADDER, ['c4', 'd4'], ['e2', 'e4']],
    [LADDER, ['c4', 'e3', 'd5'], ['e5']],
    [LADDER, ['c4', 'd4', 'e4'], ['e1']],
    [LADDER, ['c4', 'd4', 'e2'], ['e5']],
    [LADDER, ['c4', 'e4'], ['d5']],
    [LADDER, ['c4', 'e4', 'd5'], ['e2']],
    [CORNER, [], ['e6']],
    [CORNER, ['e6'], ['f6', 'g5', 'g6']],
    [CORNER, ['e6', 'g5'], ['f7']],
    [CORNER, ['e6', 'f6'], ['g4', 'g6']],
    [CORNER, ['e6', 'g5', 'f7'], ['g7']],
    [CORNER, ['e6', 'f6', 'g6'], ['g3']],
    [CORNER, ['e6', 'f6', 'g4'], ['g7']],
    [CORNER, ['e6', 'g6'], ['f7']],
    [CORNER, ['e6', 'g6', 'f7'], ['g4']],
    [REVIEW, [], ['c2']],
    [REVIEW, ['c2'], ['d2', 'e2', 'e3']],
    [REVIEW, ['c2', 'e3'], ['d1']],
    [REVIEW, ['c2', 'd2'], ['e2', 'e4']],
    [REVIEW, ['c2', 'e3', 'd1'], ['e1']],
    [REVIEW, ['c2', 'd2', 'e2'], ['e5']],
    [REVIEW, ['c2', 'd2', 'e4'], ['e1']],
    [REVIEW, ['c2', 'e2'], ['d1']],
    [REVIEW, ['c2', 'e2', 'd1'], ['e4']],
  ];

  it.each(table.map(([ex, moves, set]) => [ex.id, moves.join(' ') || 'start', ex, moves, set]))(
    '%s after %s',
    (_id, _label, ex, moves, set) => {
      expect(
        accepted(ex as SequenceExercise, after(ex as SequenceExercise, moves as string[])),
      ).toEqual(set);
    },
  );

  it('AC 24: every legal tap at every reachable position costs ≤ 150 nodes', () => {
    let worst = 0;
    for (const [ex, moves] of table) {
      const progress = after(ex, moves);
      const problem = {
        attacker: ex.toPlay,
        target: ex.goal.kind === 'capture' ? ex.goal.target : '',
        maxMoves: learnerMoveCount(ex) - progress.ply / 2,
      };
      for (const p of legalMoves(progress.state)) {
        const j = judgeAttack(progress.state, problem, p);
        if (j.ok) worst = Math.max(worst, j.nodes);
        expect(j.ok && j.capped).toBe(false);
      }
    }
    expect(worst).toBeLessThanOrEqual(150);
  });
});

describe('C. judge (AC 14–20)', () => {
  it('AC 14: Move 1 of M with M = maxMoves (default the canonical count)', () => {
    for (const ex of ALL) {
      expect(learnerMoveCount(ex)).toBe(4);
      expect(moveNumber(ex, 0)).toBe(1);
    }
    expect(
      learnerMoveCount({ ...LADDER, judge: { kind: 'search', opponent: 'run', maxMoves: 5 } }),
    ).toBe(5);
  });

  it('AC 15: an accepted move gets the displayed reply; progress counts learner moves', () => {
    const j = judgeSequence(LADDER, sequenceStart(LADDER), pt(LADDER, 'c4'));
    expect(j.kind).toBe('next');
    if (j.kind !== 'next') return;
    expect(j.replies.map((s) => vx(s.state, s.point))).toEqual(['d3']);
    expect(moveNumber(LADDER, advance(sequenceStart(LADDER), j).ply)).toBe(2);
  });

  it('AC 16: the capturing move solves it with no reply; 4 stones captured', () => {
    const progress = after(LADDER, ['c4', 'e3', 'd5']);
    const j = judgeSequence(LADDER, progress, pt(LADDER, 'e5'));
    expect(j.kind).toBe('solved');
    if (j.kind !== 'solved') return;
    expect(j.replies).toEqual([]);
    expect(capturedSince(sequenceStart(LADDER).state, j.move.state, 'B')).toBe(4);
  });

  it('AC 17–18: first move d3: the reply W c4 and "atari but escapes" + "3 liberties"', () => {
    const j = judgeSequence(LADDER, sequenceStart(LADDER), pt(LADDER, 'd3'));
    expect(j.kind).toBe('wrong');
    if (j.kind !== 'wrong') return;
    expect(j.replies.map((s) => vx(s.state, s.point))).toEqual(['c4']);
    expect(j.lines).toEqual([
      { key: 'sequence.wrong.atariButEscapes' },
      { key: 'sequence.wrong.afterReply', params: { count: 3 } },
    ]);
  });

  it('AC 18: move 3 e4 after c4 d3 e3 d4: reply W d5, "atari…" + "2 liberties"', () => {
    const progress = after(LADDER, ['c4', 'e3']);
    const j = judgeSequence(LADDER, progress, pt(LADDER, 'e4'));
    expect(j.kind).toBe('wrong');
    if (j.kind !== 'wrong') return;
    expect(j.replies.map((s) => vx(s.state, s.point))).toEqual(['d5']);
    expect(j.lines).toEqual([
      { key: 'sequence.wrong.atariButEscapes' },
      { key: 'sequence.wrong.afterReply', params: { count: 2 } },
    ]);
  });

  it('AC 18: a reply that captures chasers gives chaserCaptured (count)', () => {
    // maxMoves 5: after the detour c4 e3 e4 (W d3 d4 d5), B e5 is answered by W e2 capturing 3.
    const five = {
      ...LADDER,
      judge: { kind: 'search' as const, opponent: 'run' as const, maxMoves: 5 },
    };
    let progress = sequenceStart(five);
    for (const at of ['c4', 'e3']) {
      const j = judgeSequence(five, progress, pt(five, at));
      if (j.kind !== 'next') throw new Error(at);
      progress = advance(progress, j);
    }
    const detour = judgeSequence(five, progress, pt(five, 'e4'));
    expect(detour.kind).toBe('next'); // 5 moves: e4 d5 c5 (pass) e5
    if (detour.kind !== 'next') return;
    progress = advance(progress, detour);
    const j = judgeSequence(five, progress, pt(five, 'e5'));
    expect(j.kind).toBe('wrong');
    if (j.kind !== 'wrong') return;
    expect(j.replies.map((s) => vx(s.state, s.point))).toEqual(['e2']);
    expect(j.lines).toEqual([
      { key: 'sequence.wrong.atariButEscapes' },
      { key: 'sequence.wrong.chaserCaptured', params: { count: 3 } },
    ]);
  });

  it('AC 5 / 18: the defender passes (no reply stone); the learner continues and captures', () => {
    const five = {
      ...LADDER,
      judge: { kind: 'search' as const, opponent: 'run' as const, maxMoves: 5 },
    };
    let progress = sequenceStart(five);
    for (const at of ['c4', 'e3', 'e4']) {
      const j = judgeSequence(five, progress, pt(five, at));
      if (j.kind !== 'next') throw new Error(at);
      progress = advance(progress, j);
    }
    const c5 = judgeSequence(five, progress, pt(five, 'c5'));
    expect(c5.kind).toBe('next');
    if (c5.kind !== 'next') return;
    expect(c5.replies).toEqual([]);
    progress = advance(progress, c5);
    expect(progress.state.toPlay).toBe('B');
    expect(judgeSequence(five, progress, pt(five, 'e5')).kind).toBe('solved');
  });

  it('AC 18 (iii): no reply (the defender passes) → the liberty count after the move', () => {
    // The detour position, 1 move left: B c5 leaves White only the suicide e5, White passes,
    // and Black has no move left for e5.
    //   5 . . X O .
    //   4 . . X O X
    //   3 . X O O X
    //   2 . . X X .
    //   1 . . . . .
    const detour: SequenceExercise = {
      ...LADDER,
      setup: { B: ['b3', 'c2', 'd2', 'c4', 'e3', 'e4'], W: ['c3', 'd3', 'd4', 'd5'] },
      line: [{ color: 'B', at: 'e5' }],
      judge: { kind: 'search', opponent: 'run' },
    };
    const j = judgeSequence(detour, sequenceStart(detour), pt(detour, 'c5'));
    expect(j.kind).toBe('wrong');
    if (j.kind !== 'wrong') return;
    expect(j.replies).toEqual([]);
    expect(j.lines).toEqual([
      { key: 'sequence.wrong.atariButEscapes' },
      { key: 'sequence.wrong.liberties', params: { count: 1 } },
    ]);
  });

  it('AC 19: d4 at move 2 is treated like a line move; the e4/e2 branch solves with 4 captured', () => {
    const progress = after(LADDER, ['c4', 'd4', 'e4']);
    const j = judgeSequence(LADDER, progress, pt(LADDER, 'e1'));
    expect(j.kind).toBe('solved');
    if (j.kind !== 'solved') return;
    expect(capturedSince(sequenceStart(LADDER).state, j.move.state, 'B')).toBe(4);
  });

  it('AC 20: the hint follows the line while on it, else the first winning move', () => {
    expect(hintPoint(LADDER, sequenceStart(LADDER))).toBe('c4');
    expect(hintPoint(LADDER, after(LADDER, ['c4']))).toBe('e3');
    expect(hintPoint(LADDER, after(LADDER, ['c4', 'e3']))).toBe('d5');
    expect(hintPoint(LADDER, after(LADDER, ['c4', 'd4']))).toBe('e2');
    expect(hintPoint(CORNER, after(CORNER, ['e6', 'f6']))).toBe('g4');
    expect(hintPoint(REVIEW, after(REVIEW, ['c2', 'd2']))).toBe('e2');
  });
});
