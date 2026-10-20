// count (spec §6.4): a display-only board, number chips 0–9 in two rows, then *Check*.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GoBoard } from '@/board';
import {
  getSolution,
  solutionPoints,
  lastPlayedPoint,
  startState,
  toStepMarkers,
  type CountExercise,
} from '@/lessons';
import { color, radius, spacing, typography } from '@/theme/tokens';

import { ExerciseFrame } from '../ExerciseFrame';
import { highlight, hintHighlight, type RunnerProps } from './types';

const CHIP_ROWS = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
];

export function CountRunner({
  exercise,
  coordinates,
  boardWidth,
  attempts,
  dispatch,
  feedback,
  next,
}: RunnerProps<CountExercise>) {
  const { t } = useTranslation();
  const { size } = exercise;
  const start = useMemo(() => startState(exercise), [exercise]);
  const stones = start.board.cells;
  // A prelude's last move keeps the normal last-move mark (spec M5 AC 12).
  const lastMove = useMemo(() => lastPlayedPoint(start), [start]);
  const markers = useMemo(() => toStepMarkers(exercise.markers, size), [exercise, size]);
  const value = useMemo(() => getSolution(exercise).value, [exercise]);
  const active = attempts.status === 'active';
  const revealed = attempts.status === 'revealed';
  const [chip, setChip] = useState<number | null>(null);

  const select = (n: number) => {
    if (!active) return;
    setChip(n);
    dispatch({ type: 'clear' });
  };
  const check = () => {
    if (chip === null) return;
    if (chip === value) dispatch({ type: 'correct' });
    else dispatch({ type: 'wrong', lines: [{ key: 'fb.count.wrong' }] });
  };

  const highlights = [
    ...highlight('success', revealed ? solutionPoints(exercise) : [], size),
    ...hintHighlight(exercise, attempts),
  ];

  return (
    <ExerciseFrame
      feedback={feedback}
      action={
        active
          ? {
              label: t('practice.check'),
              onPress: check,
              disabled: chip === null,
              testID: 'practice-check',
            }
          : next
      }
    >
      <View style={styles.boardRow}>
        <GoBoard
          lastMove={lastMove}
          size={size}
          stones={stones}
          width={boardWidth}
          showCoordinates={coordinates}
          highlights={highlights}
          markers={markers}
          sound={false}
          testID="practice-board"
        />
      </View>
      <View style={styles.chips}>
        {CHIP_ROWS.map((row, r) => (
          <View key={r} style={styles.chipRow}>
            {row.map((n) => {
              const selected = chip === n && active;
              const right = !active && n === value;
              return (
                <Pressable
                  key={n}
                  testID={`practice-chip-${n}`}
                  onPress={() => select(n)}
                  disabled={!active}
                  accessibilityRole="button"
                  accessibilityLabel={t('practice.count.chip.a11y', { n })}
                  accessibilityState={{ selected, disabled: !active }}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    right && styles.chipRight,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {String(n)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ExerciseFrame>
  );
}

const styles = StyleSheet.create({
  boardRow: { alignItems: 'center' },
  chips: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    minWidth: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
  },
  chipSelected: { backgroundColor: color.accent, borderColor: color.accent },
  chipRight: { borderColor: color.success, borderWidth: 2 },
  chipText: { ...typography.label, fontSize: 18, color: color.textPrimary },
  chipTextSelected: { color: color.onAccent },
  pressed: { opacity: 0.7 },
});
