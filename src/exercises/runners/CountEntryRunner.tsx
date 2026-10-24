// count with a `score` answer (spec docs/specs/M5-territory-counting.md §5.2, AC 39–46): a
// two-digit entry pad, scratch dots on the board, and a typed wrong-count line from engine facts.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { GoBoard, vertexLabel, type Highlight, type Marker } from '@/board';
import { parseVertex, toVertex, type Point, type Vertex } from '@/engine';
import {
  getSolution,
  groupStones,
  scoreFacts,
  startState,
  toStepMarkers,
  type CountExercise,
  type ScoreAnswer,
} from '@/lessons';
import { color, radius, spacing, textScale, typography } from '@/theme/tokens';

import { ExerciseFrame } from '../ExerciseFrame';
import { classifyScoreAnswer } from '../scoreAnswer';
import { highlight, hintHighlight, type RunnerProps } from './types';

const ALWAYS_LEGAL = () => ({ legal: true }) as const;
const KEY_ROWS = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
];
/** Symbols, not words: the key's spoken label is `practice.count.backspace`. */
const BACKSPACE_GLYPH = '\u232B';
const EMPTY_GLYPH = '\u2014';
/** The display shows at most two digits (AC 40). */
export const MAX_DIGITS = 2;

/** Appends a digit: at most two digits; a leading 0 is replaced by the next digit. */
export function typeDigit(entry: string, digit: number): string {
  if (entry === '0') return String(digit);
  return entry.length >= MAX_DIGITS ? entry : entry + String(digit);
}

export function scoreAnswerOf(exercise: CountExercise): ScoreAnswer | null {
  const { answer } = exercise;
  return typeof answer === 'object' && 'score' in answer ? answer.score : null;
}

export function CountEntryRunner({
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
  const answer = scoreAnswerOf(exercise) as ScoreAnswer;
  const board = useMemo(() => startState(exercise).board, [exercise]);
  const markers = useMemo(() => toStepMarkers(exercise.markers, size), [exercise, size]);
  const value = useMemo(() => getSolution(exercise).value, [exercise]);
  const dead = useMemo(() => groupStones(board, answer.dead ?? []), [board, answer]);
  const territory = useMemo(
    () =>
      scoreFacts(board, answer.dead)[answer.side].points.filter(
        (v) => board.cells[indexOf(v, size)] === null,
      ),
    [board, answer, size],
  );
  const active = attempts.status === 'active';
  const revealed = attempts.status === 'revealed';
  const correct = attempts.status === 'correct';

  const [entry, setEntry] = useState('');
  const [dots, setDots] = useState<Vertex[]>([]);

  const press = (digit: number) => {
    if (!active) return;
    setEntry((e) => typeDigit(e, digit));
  };
  const backspace = () => {
    if (!active) return;
    setEntry((e) => e.slice(0, -1));
  };
  const check = () => {
    if (entry === '') return;
    const line = classifyScoreAnswer(board, answer, Number(entry));
    if (line === null) dispatch({ type: 'correct' });
    else dispatch({ type: 'wrong', lines: [line] });
  };
  const onScratch = (p: Point) => {
    const at = toVertex(p, size);
    setDots((d) => (d.includes(at) ? d.filter((v) => v !== at) : [...d, at]));
    AccessibilityInfo.announceForAccessibility(
      t('practice.count.scratch.a11y', { point: vertexLabel(p, size) }),
    );
  };

  const shownEntry = revealed ? String(value) : entry;
  const highlights: Highlight[] = [
    ...highlight('scratch', dots, size),
    ...(active
      ? []
      : highlight(answer.side === 'B' ? 'territoryB' : 'territoryW', territory, size)),
    ...hintHighlight(exercise, attempts),
  ];
  const boardMarkers: Marker[] = [
    ...markers,
    ...dead.map((v) => ({ kind: 'dead' as const, point: parseVertex(v, size) })),
  ];
  const action = active
    ? {
        label: t('practice.check'),
        onPress: check,
        disabled: entry === '',
        testID: 'practice-check',
      }
    : next;

  return (
    <ExerciseFrame feedback={feedback} action={null}>
      <View style={styles.boardRow}>
        <GoBoard
          size={size}
          stones={board.cells}
          width={boardWidth}
          showCoordinates={coordinates}
          interactive
          disabled={!active}
          pointer="ring"
          checkPoint={ALWAYS_LEGAL}
          onPlay={onScratch}
          highlights={highlights}
          markers={boardMarkers}
          sound={false}
          testID="practice-board"
        />
      </View>
      <View style={styles.entryRow}>
        <View
          testID="practice-count-display"
          accessible
          accessibilityLabel={
            shownEntry === ''
              ? t('practice.count.entry.empty')
              : t('practice.count.entry.a11y', { value: shownEntry })
          }
          style={[styles.display, correct && styles.displayRight, revealed && styles.displayRight]}
        >
          <Text
            maxFontSizeMultiplier={textScale.hud}
            style={[styles.displayText, shownEntry === '' && styles.placeholder]}
          >
            {shownEntry === '' ? EMPTY_GLYPH : shownEntry}
          </Text>
        </View>
        <Pressable
          testID="practice-count-backspace"
          onPress={backspace}
          disabled={!active || entry === ''}
          accessibilityRole="button"
          accessibilityLabel={t('practice.count.backspace')}
          accessibilityState={{ disabled: !active || entry === '' }}
          style={({ pressed }) => [
            styles.key,
            styles.backspace,
            (!active || entry === '') && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text maxFontSizeMultiplier={textScale.hud} style={styles.keyText}>
            {BACKSPACE_GLYPH}
          </Text>
        </Pressable>
        <Pressable
          testID={action.testID}
          onPress={action.onPress}
          disabled={action.disabled}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: action.disabled ?? false }}
          style={({ pressed }) => [
            styles.check,
            action.disabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text maxFontSizeMultiplier={textScale.hud} style={styles.checkText}>
            {action.label}
          </Text>
        </Pressable>
      </View>
      <View style={styles.keys}>
        {KEY_ROWS.map((row, r) => (
          <View key={r} style={styles.keyRow}>
            {row.map((n) => (
              <Pressable
                key={n}
                testID={`practice-key-${n}`}
                onPress={() => press(n)}
                disabled={!active}
                accessibilityRole="button"
                accessibilityLabel={t('practice.count.chip.a11y', { n })}
                accessibilityState={{ disabled: !active }}
                style={({ pressed }) => [styles.key, styles.digit, pressed && styles.pressed]}
              >
                <Text maxFontSizeMultiplier={textScale.hud} style={styles.keyText}>
                  {String(n)}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </ExerciseFrame>
  );
}

function indexOf(v: Vertex, size: CountExercise['size']): number {
  const p = parseVertex(v, size);
  return p.y * size + p.x;
}

const KEY_HEIGHT = 44;

const styles = StyleSheet.create({
  boardRow: { alignItems: 'center' },
  entryRow: { flexDirection: 'row', gap: spacing.sm, height: KEY_HEIGHT },
  display: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
  },
  displayRight: { borderColor: color.success, borderWidth: 2 },
  displayText: { ...typography.title, color: color.textPrimary },
  placeholder: { color: color.textSecondary },
  keys: { gap: spacing.sm },
  keyRow: { flexDirection: 'row', gap: spacing.sm },
  key: {
    height: KEY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
  },
  digit: { flex: 1, minWidth: KEY_HEIGHT },
  backspace: { width: 56 },
  keyText: { ...typography.label, fontSize: 18, color: color.textPrimary },
  check: {
    width: 100,
    height: KEY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accent,
    borderRadius: radius.sm,
  },
  checkText: { ...typography.label, color: color.onAccent },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
