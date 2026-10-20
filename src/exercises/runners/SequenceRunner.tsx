// Multi-move problem runner (spec docs/specs/M5-life-death.md §5, AC 14–33; search-judged
// problems: docs/specs/M5-sequence-v2.md AC 14–24): the learner plays,
// the opponent answers by itself, until the line is complete. All judging is in ../sequence.ts;
// this file only schedules the automatic stones and draws the screen.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoBoard, type CaptureEvent, type Highlight } from '@/board';
import { useReduceMotion } from '@/board/useReduceMotion';
import { parseVertex, toVertex, type GameState, type IllegalReason, type Point } from '@/engine';
import { toStepMarkers, type Lesson, type Outcome, type SequenceExercise } from '@/lessons';
import { Button } from '@/theme/Button';
import { color, radius, spacing, tapTarget, typography } from '@/theme/tokens';

import {
  INITIAL_ATTEMPTS,
  attemptsReducer,
  hasHint,
  maxWrongAttempts,
  outcomeOf,
  type FeedbackLine,
} from '../attempts';
import { checkExerciseMove } from '../engineAdapter';
import { FeedbackCard, type FeedbackText } from '../ExerciseFrame';
import { ExerciseTopBar } from '../ExerciseTopBar';
import { illegalFeedback } from '../feedback';
import { PRACTICE_FIXED_HEIGHT, boardWidthFor } from '../layout';
import {
  advance,
  answerStones,
  capturedSince,
  hintPoint,
  judgeSequence,
  learnerMoveCount,
  moveNumber,
  positionAfter,
  recoveryOf,
  sequenceStart,
  type SequenceProgress,
  type SequenceStone,
} from '../sequence';

/** Delay before each automatic stone (AC 15, 18); reduced motion: AC 31. */
export const REPLY_MS = 500;
export const REPLY_MS_REDUCED = 250;
/** Delay between the stones of the revealed answer (AC 23). */
export const REVEAL_MS = 800;
/** The "Move n of m" row (AC 29). */
export const PROGRESS_ROW_HEIGHT = 28;

type Phase = 'play' | 'replying' | 'wrong' | 'done';

interface Shown {
  state: GameState;
  lastMove: Point | null;
  capture: CaptureEvent | null;
}

interface Mistake {
  point: Point;
  recovery: 'undo' | 'restart';
}

type Props = {
  lesson: Lesson;
  index: number;
  exercise: SequenceExercise;
  onClose: () => void;
  onDone: (outcome: Outcome) => void;
};

const other = (c: 'B' | 'W') => (c === 'B' ? 'W' : 'B');

export function SequenceRunner({ lesson, index, exercise, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { size, toPlay } = exercise;
  const total = lesson.exercises.length;
  const m = learnerMoveCount(exercise);

  const reducer = useMemo(() => attemptsReducer(exercise), [exercise]);
  const [attempts, dispatch] = useReducer(reducer, INITIAL_ATTEMPTS);
  const start = useMemo(() => sequenceStart(exercise), [exercise]);
  const markers = useMemo(() => toStepMarkers(exercise.markers, size), [exercise, size]);

  const [progress, setProgress] = useState<SequenceProgress>(start);

  const [shown, setShown] = useState<Shown>({ state: start.state, lastMove: null, capture: null });
  const [phase, setPhase] = useState<Phase>('play');
  const [mistake, setMistake] = useState<Mistake | null>(null);
  const [captured, setCaptured] = useState<number | null>(null);

  // Timers of the automatic stones: cleared on unmount, so nothing fires after leaving (AC 25).
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const captureId = useRef(0);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const active = attempts.status === 'active';
  const revealed = attempts.status === 'revealed';

  /** Draws one stone (learner's or automatic) with its capture fade. */
  const showStone = (s: SequenceStone) => {
    const points = s.facts.captured.flat();
    captureId.current += 1;
    setShown({
      state: s.state,
      lastMove: s.point,
      capture: points.length > 0 ? { id: captureId.current, color: other(s.color), points } : null,
    });
  };

  /** Plays `stones` one after another, `delay` ms apart, then calls `done`. */
  const schedule = (stones: SequenceStone[], delay: number, done: () => void, announce = true) => {
    stones.forEach((s, i) => {
      timers.current.push(
        setTimeout(
          () => {
            showStone(s);
            if (announce) {
              AccessibilityInfo.announceForAccessibility(
                t(`sequence.a11y.plays.${s.color}`, { point: toVertex(s.point, size) }),
              );
            }
          },
          delay * (i + 1),
        ),
      );
    });
    timers.current.push(setTimeout(done, delay * stones.length));
  };

  const replyMs = reduceMotion ? REPLY_MS_REDUCED : REPLY_MS;

  /** Three mistakes: the board resets and the answer is played (AC 23), or shown at once (AC 31). */
  const reveal = () => {
    clearTimers();
    setMistake(null);
    setPhase('done');
    const stones = answerStones(exercise);
    if (reduceMotion) {
      const last = stones[stones.length - 1];
      setShown({ state: last.state, lastMove: last.point, capture: null });
      return;
    }
    setShown({ state: start.state, lastMove: null, capture: null });
    schedule(stones, REVEAL_MS, () => {}, false);
  };

  /** Counts a mistake (the attempts reducer decides when the answer is revealed). */
  const mistakeMade = (lines: FeedbackLine[]) => {
    dispatch({ type: 'wrong', lines });
    if (attempts.wrong + 1 >= maxWrongAttempts(exercise)) reveal();
  };

  const onPlay = (p: Point) => {
    if (!active || phase !== 'play') return;
    const judgement = judgeSequence(exercise, progress, p);
    if (judgement.kind === 'illegal') {
      dispatch({ type: 'info', lines: illegalFeedback(judgement.reason) });
      return;
    }
    dispatch({ type: 'clear' });
    showStone(judgement.move);
    switch (judgement.kind) {
      case 'next':
        setPhase('replying');
        schedule(judgement.replies, replyMs, () => {
          setProgress(advance(progress, judgement));
          setPhase('play');
        });
        return;
      case 'solved': {
        const finish = () => {
          setCaptured(capturedSince(start.state, positionAfter(judgement), toPlay));
          setPhase('done');
          dispatch({ type: 'correct' });
        };
        if (judgement.replies.length === 0) finish();
        else {
          setPhase('replying');
          schedule(judgement.replies, replyMs, finish);
        }
        return;
      }
      case 'refuted':
        setPhase('replying');
        setMistake({ point: judgement.move.point, recovery: 'restart' });
        schedule(judgement.replies, replyMs, () => {
          setPhase('wrong');
          mistakeMade(judgement.lines);
        });
        return;
      case 'wrong': {
        setMistake({
          point: judgement.move.point,
          recovery: recoveryOf(progress.ply, 'wrong'),
        });
        // Search judging shows the defender's escape first (M5-sequence-v2 AC 17).
        if (judgement.replies.length === 0) {
          setPhase('wrong');
          mistakeMade(judgement.lines);
          return;
        }
        setPhase('replying');
        schedule(judgement.replies, replyMs, () => {
          setPhase('wrong');
          mistakeMade(judgement.lines);
        });
        return;
      }
    }
  };

  const onIllegal = (_p: Point, reason: IllegalReason) => {
    if (active && phase === 'play') dispatch({ type: 'info', lines: illegalFeedback(reason) });
  };

  /** *Try again* (restart, AC 21) or *Undo* (later ply, progress kept, AC 20). */
  const recover = () => {
    clearTimers();
    if (mistake?.recovery === 'undo') {
      setShown({ state: progress.state, lastMove: null, capture: null });
    } else {
      setProgress(start);
      setShown({ state: start.state, lastMove: null, capture: null });
    }
    setMistake(null);
    setPhase('play');
    dispatch({ type: 'clear' });
  };

  // Feedback card (AC 16, 18–20, 27) and its screen-reader announcement (AC 32).
  const feedback: FeedbackText[] = [];
  const explain = exercise.explainKey ? t(exercise.explainKey) : null;
  if (attempts.status === 'correct') {
    feedback.push(
      exercise.goal.kind === 'capture' && captured !== null
        ? { text: t('sequence.captured', { count: captured }), tone: 'success' }
        : { text: t('fb.correct'), tone: 'success' },
    );
    if (explain) feedback.push({ text: explain, tone: 'success' });
  } else if (revealed) {
    feedback.push({ text: t('fb.revealed'), tone: 'success' });
    if (explain) feedback.push({ text: explain, tone: 'success' });
  } else {
    for (const line of attempts.message ?? [])
      feedback.push({ text: t(line.key, line.params), tone: 'error' });
    if (attempts.hintOpen && exercise.hintKey)
      feedback.push({ text: t(exercise.hintKey), tone: 'hint' });
  }
  const announcement = feedback.map((line) => line.text).join(' ');
  useEffect(() => {
    if (announcement) AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  // Rings: the dashed rouge mistake, the green last stone, the amber next point (AC 18, 16, 27–28).
  const highlights: Highlight[] = [];
  if (active && mistake && (phase === 'wrong' || phase === 'replying')) {
    highlights.push({ kind: 'error', points: [mistake.point], dashed: true });
  }
  if (attempts.status === 'correct' && shown.lastMove) {
    highlights.push({ kind: 'success', points: [shown.lastMove] });
  }
  // The hint ring follows the position (M5-sequence-v2 AC 20); searched only while the hint is open.
  const hintOpen = attempts.hintOpen;
  const next = useMemo(
    () => (hintOpen ? hintPoint(exercise, progress) : null),
    [hintOpen, exercise, progress],
  );
  if (active && attempts.hintOpen && phase === 'play' && next) {
    highlights.push({ kind: 'hint', points: [parseVertex(next, size)] });
  }

  // Progress row (AC 14, 15, 32).
  const n = moveNumber(exercise, progress.ply);
  const doneMoves = attempts.status === 'correct' ? m : Math.floor(progress.ply / 2);
  const status = revealed
    ? t('sequence.answer')
    : attempts.status === 'correct'
      ? t('sequence.done')
      : phase === 'replying'
        ? t(`sequence.replies.${other(toPlay)}`)
        : phase === 'play'
          ? t('sequence.yourTurn')
          : '';
  const progressLabel = t('sequence.progress', { n: attempts.status === 'correct' ? m : n, m });

  // Board size: the practice budget plus the progress row (AC 29).
  const free =
    window.height -
    insets.top -
    insets.bottom -
    PRACTICE_FIXED_HEIGHT -
    PROGRESS_ROW_HEIGHT -
    spacing.sm;
  const boardWidth = Math.max(0, Math.min(boardWidthFor(window.width), free));

  const isLast = index === total - 1;
  const hintAvailable = hasHint(exercise);
  const showHint = hintAvailable && active;
  const recoverLabel = mistake?.recovery === 'undo' ? t('sequence.undo') : t('practice.tryAgain');

  return (
    <>
      <ExerciseTopBar index={index} total={total} onClose={onClose} />

      <View style={styles.prompt} testID="practice-prompt">
        <Text style={styles.promptText}>{t(exercise.promptKey)}</Text>
      </View>

      <View
        style={styles.progressRow}
        testID="sequence-progress"
        accessible
        accessibilityLabel={progressLabel}
      >
        <Text style={styles.progressText}>{progressLabel}</Text>
        <View style={styles.dots}>
          {Array.from({ length: m }, (_, i) => (
            <View
              key={i}
              testID={i < doneMoves ? 'sequence-dot-done' : 'sequence-dot'}
              style={[styles.dot, i < doneMoves && styles.dotDone]}
            />
          ))}
        </View>
        <Text style={styles.status} numberOfLines={1} testID="sequence-status">
          {status}
        </Text>
      </View>

      <View style={styles.frame}>
        <GoBoard
          size={size}
          stones={shown.state.board.cells}
          width={boardWidth}
          showCoordinates={lesson.coordinates ?? false}
          interactive
          disabled={!active || phase !== 'play'}
          playerColor={toPlay}
          checkPoint={(p) => checkExerciseMove(progress.state, p)}
          onPlay={onPlay}
          onIllegal={onIllegal}
          lastMove={shown.lastMove}
          lastCapture={shown.capture}
          highlights={highlights}
          markers={markers}
          testID="practice-board"
        />
        <FeedbackCard lines={feedback} />
        <View style={styles.spacer} />
        <View style={styles.buttons}>
          {!active ? (
            <Button
              label={isLast ? t('practice.finish') : t('practice.next')}
              onPress={() => onDone(outcomeOf(attempts))}
              testID={isLast ? 'practice-finish' : 'practice-next'}
              style={styles.button}
            />
          ) : (
            <>
              {showHint ? (
                <Button
                  variant="secondary"
                  label={t('practice.hint')}
                  onPress={() => dispatch({ type: 'hint' })}
                  disabled={attempts.hintOpen}
                  testID="practice-hint"
                  style={[styles.button, attempts.hintOpen && styles.hintOpen]}
                />
              ) : null}
              {phase === 'wrong' && mistake ? (
                <Button
                  label={recoverLabel}
                  onPress={recover}
                  testID={mistake.recovery === 'undo' ? 'sequence-undo' : 'practice-try-again'}
                  style={styles.button}
                />
              ) : null}
            </>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  prompt: {
    minHeight: 72,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  promptText: { ...typography.body, color: color.textPrimary },
  progressRow: {
    height: PROGRESS_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressText: { ...typography.caption, color: color.textPrimary, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: spacing.xs },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: color.textSecondary,
  },
  dotDone: { backgroundColor: color.textSecondary },
  status: { ...typography.caption, color: color.textSecondary, flex: 1, textAlign: 'right' },
  frame: { flex: 1, gap: spacing.sm, alignItems: 'stretch' },
  spacer: { flex: 1 },
  buttons: { flexDirection: 'row', gap: spacing.md, minHeight: tapTarget.min },
  button: { flex: 1 },
  hintOpen: { backgroundColor: color.hintSoft, borderColor: color.hint },
});
