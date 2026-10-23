// choice (spec §6.4): a display-only board with labels, 2–4 answer buttons in authored order.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GoBoard } from '@/board';
import {
  getSolution,
  lastPlayedPoint,
  startState,
  toStepMarkers,
  type ChoiceExercise,
} from '@/lessons';
import { color, radius, spacing, textScale, typography } from '@/theme/tokens';

import { ExerciseFrame } from '../ExerciseFrame';
import { OPTION_GAP, OPTION_HEIGHT } from '../layout';
import { hintHighlight, type RunnerProps } from './types';

export function ChoiceRunner({
  exercise,
  coordinates,
  boardWidth,
  attempts,
  dispatch,
  feedback,
  next,
}: RunnerProps<ChoiceExercise>) {
  const { t } = useTranslation();
  const { size } = exercise;
  const start = useMemo(() => startState(exercise), [exercise]);
  const stones = start.board.cells;
  // A prelude's last move keeps the normal last-move mark (spec M5 AC 12).
  const lastMove = useMemo(() => lastPlayedPoint(start), [start]);
  const markers = useMemo(() => toStepMarkers(exercise.markers, size), [exercise, size]);
  const correctIndex = useMemo(() => getSolution(exercise).index, [exercise]);
  const active = attempts.status === 'active';
  const [wrong, setWrong] = useState<number[]>([]);

  const choose = (index: number) => {
    if (!active || wrong.includes(index)) return;
    if (index === correctIndex) {
      dispatch({ type: 'correct' });
      return;
    }
    setWrong((w) => [...w, index]);
    const whyKey = exercise.options[index].whyKey;
    dispatch({ type: 'wrong', lines: [whyKey ? { key: whyKey } : { key: 'fb.choice.wrong' }] });
  };

  return (
    <ExerciseFrame feedback={feedback} action={active ? null : next}>
      <View style={styles.boardRow}>
        <GoBoard
          lastMove={lastMove}
          size={size}
          stones={stones}
          width={boardWidth}
          showCoordinates={coordinates}
          highlights={hintHighlight(exercise, attempts)}
          markers={markers}
          sound={false}
          testID="practice-board"
        />
      </View>
      <View style={styles.options}>
        {exercise.options.map((option, i) => {
          const isWrong = wrong.includes(i);
          const shownRight = !active && i === correctIndex;
          const disabled = !active || isWrong;
          return (
            <Pressable
              key={i}
              testID={`practice-option-${i}`}
              onPress={() => choose(i)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={t(option.textKey)}
              accessibilityState={{ disabled, selected: shownRight }}
              style={({ pressed }) => [
                styles.option,
                isWrong && styles.optionWrong,
                shownRight && styles.optionRight,
                pressed && styles.pressed,
              ]}
            >
              <Text
                maxFontSizeMultiplier={textScale.hud}
                style={[styles.optionText, isWrong && styles.optionTextWrong]}
              >
                {t(option.textKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ExerciseFrame>
  );
}

const styles = StyleSheet.create({
  boardRow: { alignItems: 'center' },
  options: { gap: OPTION_GAP },
  option: {
    minHeight: OPTION_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  optionWrong: { backgroundColor: color.background, opacity: 0.6 },
  optionRight: { borderColor: color.success, borderWidth: 2 },
  optionText: { ...typography.body, color: color.textPrimary },
  optionTextWrong: { color: color.textSecondary },
  pressed: { opacity: 0.7 },
});
