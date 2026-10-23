// mark (spec docs/specs/M5-territory-counting.md §5.3, AC 22–38): tap empty points to mark one
// side's territory, or tap stones to mark dead groups, then *Check*. Taps toggle at once.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { GoBoard, vertexLabel, type Highlight, type Marker } from '@/board';
import { parseVertex, toVertex, type Point, type Vertex } from '@/engine';
import { getSolution, startState, toStepMarkers, type MarkExercise } from '@/lessons';
import { color, spacing, tapTarget, textScale, typography } from '@/theme/tokens';

import { ExerciseFrame } from '../ExerciseFrame';
import { judgeMarks, tapMark } from '../mark';
import { FLASH_MS, highlight, hintHighlight, type RunnerProps } from './types';

const ALWAYS_LEGAL = () => ({ legal: true }) as const;
/** The status row above the board: "Marked: n" and *Clear* (§5.2). */
export const MARK_STATUS_HEIGHT = 36;

export function MarkRunner({
  exercise,
  coordinates,
  boardWidth,
  attempts,
  dispatch,
  feedback,
  next,
}: RunnerProps<MarkExercise>) {
  const { t } = useTranslation();
  const { size } = exercise;
  const board = useMemo(() => startState(exercise).board, [exercise]);
  const markers = useMemo(() => toStepMarkers(exercise.markers, size), [exercise, size]);
  const answer = useMemo(() => getSolution(exercise).points, [exercise]);
  const active = attempts.status === 'active';
  const dead = exercise.mark === 'dead';

  const [marks, setMarks] = useState<Vertex[]>([]);
  const [flash, setFlash] = useState<Vertex[]>([]);
  /** The feedback card shows a note (not a mistake) that the next mark may clear. */
  const noteShown = useRef(false);
  useEffect(() => {
    if (flash.length === 0) return;
    const timer = setTimeout(() => setFlash([]), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  const onPlay = (p: Point) => {
    if (!active) return;
    const at = toVertex(p, size);
    const tap = tapMark(board, exercise, marks, at);
    if (tap.kind === 'note') {
      noteShown.current = true;
      dispatch({ type: 'info', lines: [tap.line] });
      return;
    }
    if (noteShown.current) {
      noteShown.current = false;
      dispatch({ type: 'clear' });
    }
    setMarks(tap.marks);
    const point = { point: vertexLabel(p, size) };
    AccessibilityInfo.announceForAccessibility(
      !tap.added
        ? t('practice.mark.a11y.removed', point)
        : dead
          ? t('practice.mark.a11y.dead', point)
          : exercise.side === 'W'
            ? t('practice.mark.a11y.territory.W', point)
            : t('practice.mark.a11y.territory.B', point),
    );
  };

  const check = () => {
    const result = judgeMarks(board, exercise, marks);
    noteShown.current = false;
    if (result.correct) {
      dispatch({ type: 'correct' });
      return;
    }
    setMarks(result.keep);
    setFlash(result.extra);
    dispatch({ type: 'wrong', lines: result.lines });
  };

  const clear = () => {
    setMarks([]);
    setFlash([]);
  };

  // Marks on the board: the learner's (plus extras while they flash), or the answer once revealed.
  const shown =
    attempts.status === 'revealed' ? answer : active ? [...marks, ...flash] : [...marks];
  const territoryKind = exercise.side === 'W' ? 'territoryW' : 'territoryB';
  const highlights: Highlight[] = [
    ...(dead ? [] : highlight(territoryKind, shown, size)),
    ...highlight('error', active ? flash : [], size),
    ...highlight('success', active ? [] : shown, size),
    ...hintHighlight(exercise, attempts),
  ];
  const boardMarkers: Marker[] = dead
    ? [...markers, ...shown.map((v) => ({ kind: 'dead' as const, point: parseVertex(v, size) }))]
    : markers;

  const action = active
    ? {
        label: t('practice.check'),
        onPress: check,
        disabled: marks.length === 0,
        testID: 'practice-check',
      }
    : next;

  return (
    <ExerciseFrame feedback={feedback} action={action}>
      <View style={styles.status} testID="practice-mark-status">
        <Text
          maxFontSizeMultiplier={textScale.hud}
          style={styles.count}
          testID="practice-mark-count"
        >
          {t('practice.mark.count', { count: marks.length })}
        </Text>
        {active && marks.length > 0 ? (
          <Pressable
            testID="practice-mark-clear"
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel={t('practice.mark.clear')}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Text maxFontSizeMultiplier={textScale.hud} style={styles.clearText}>
              {t('practice.mark.clear')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <GoBoard
        size={size}
        stones={board.cells}
        width={boardWidth}
        showCoordinates={coordinates}
        interactive
        disabled={!active}
        pointer="ring"
        checkPoint={ALWAYS_LEGAL}
        onPlay={onPlay}
        highlights={highlights}
        markers={boardMarkers}
        sound={false}
        testID="practice-board"
      />
    </ExerciseFrame>
  );
}

const styles = StyleSheet.create({
  status: {
    height: MARK_STATUS_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: { ...typography.label, color: color.textSecondary },
  // 44 px tall inside the 36 px row (AC 35): the extra 4 px each side overlap the gaps.
  clear: {
    minWidth: tapTarget.min,
    height: tapTarget.min,
    marginVertical: (MARK_STATUS_HEIGHT - tapTarget.min) / 2,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { ...typography.label, color: color.accent },
  pressed: { opacity: 0.7 },
});
