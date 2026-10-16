// One exercise of a practice set (spec §6.3): top bar (✕, progress, Hint), prompt, runner.
// Remounted for every exercise, so each one starts with fresh attempts.
import { useEffect, useMemo, useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Exercise, Lesson, Outcome } from '@/lessons';
import { IconButton } from '@/theme/Button';
import { CloseIcon } from '@/theme/icons';
import { color, radius, spacing, tapTarget, typography } from '@/theme/tokens';

import {
  INITIAL_ATTEMPTS,
  attemptsReducer,
  hasHint,
  outcomeOf,
  type AttemptState,
} from './attempts';
import type { FeedbackText, FrameAction } from './ExerciseFrame';
import { practiceBoardWidth } from './layout';
import { ChoiceRunner } from './runners/ChoiceRunner';
import { CountRunner } from './runners/CountRunner';
import { PlayMoveRunner } from './runners/PlayMoveRunner';
import { TapPointRunner } from './runners/TapPointRunner';

type Props = {
  lesson: Lesson;
  index: number;
  onClose: () => void;
  onDone: (outcome: Outcome) => void;
};

type T = ReturnType<typeof useTranslation>['t'];

/** The feedback card's sentences for the current attempt state (spec §6.3 table). */
function feedbackFor(exercise: Exercise, attempts: AttemptState, t: T): FeedbackText[] {
  const explain = exercise.explainKey
    ? [{ text: t(exercise.explainKey), tone: 'success' as const }]
    : [];
  if (attempts.status === 'correct')
    return [{ text: t('fb.correct'), tone: 'success' }, ...explain];
  if (attempts.status === 'revealed') {
    return [{ text: t('fb.revealed'), tone: 'success' }, ...explain];
  }
  const lines: FeedbackText[] = (attempts.message ?? []).map((line) => ({
    text: t(line.key, line.params),
    tone: 'error',
  }));
  if (attempts.hintOpen && exercise.hintKey)
    lines.push({ text: t(exercise.hintKey), tone: 'hint' });
  return lines;
}

export function ExerciseView({ lesson, index, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const exercise = lesson.exercises[index];
  const total = lesson.exercises.length;
  const reducer = useMemo(() => attemptsReducer(exercise), [exercise]);
  const [attempts, dispatch] = useReducer(reducer, INITIAL_ATTEMPTS);

  const feedback = feedbackFor(exercise, attempts, t);
  const announcement = feedback.map((line) => line.text).join(' ');
  useEffect(() => {
    if (announcement) AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  const isLast = index === total - 1;
  const next: FrameAction = {
    label: isLast ? t('practice.finish') : t('practice.next'),
    onPress: () => onDone(outcomeOf(attempts)),
    testID: isLast ? 'practice-finish' : 'practice-next',
  };
  const boardWidth = practiceBoardWidth(
    exercise.type,
    { width: window.width, height: window.height - insets.top - insets.bottom },
    exercise.type === 'choice' ? exercise.options.length : 3,
  );
  const common = {
    coordinates: lesson.coordinates ?? false,
    boardWidth,
    attempts,
    dispatch,
    feedback,
    next,
  };
  const hintEnabled = hasHint(exercise) && attempts.status === 'active' && !attempts.hintOpen;

  return (
    <>
      <View style={styles.topBar}>
        <IconButton label={t('lesson.close')} onPress={onClose} testID="practice-close">
          <CloseIcon color={color.accent} size={22} />
        </IconButton>
        <View
          style={styles.segments}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('practice.progress.a11y', { current: index + 1, total })}
          testID="practice-progress"
        >
          {lesson.exercises.map((_, i) => (
            <View
              key={i}
              testID={i < index ? 'segment-done' : i === index ? 'segment-current' : 'segment-next'}
              style={[
                styles.segment,
                i < index && styles.segmentDone,
                i === index && styles.segmentCurrent,
              ]}
            />
          ))}
        </View>
        <Pressable
          testID="practice-hint"
          onPress={() => dispatch({ type: 'hint' })}
          disabled={!hintEnabled}
          accessibilityRole="button"
          accessibilityLabel={t('practice.hint')}
          accessibilityState={{ disabled: !hintEnabled, expanded: attempts.hintOpen }}
          style={({ pressed }) => [
            styles.hint,
            attempts.hintOpen && styles.hintOpen,
            !hasHint(exercise) && styles.hintUnavailable,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.hintLabel} numberOfLines={1}>
            {t('practice.hint')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.prompt} testID="practice-prompt">
        <Text style={styles.promptText}>{t(exercise.promptKey)}</Text>
      </View>

      {exercise.type === 'tap-point' ? (
        <TapPointRunner exercise={exercise} {...common} />
      ) : exercise.type === 'play-move' ? (
        <PlayMoveRunner exercise={exercise} {...common} />
      ) : exercise.type === 'choice' ? (
        <ChoiceRunner exercise={exercise} {...common} />
      ) : (
        <CountRunner exercise={exercise} {...common} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  segments: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.border,
  },
  segmentDone: { backgroundColor: color.accent },
  segmentCurrent: {
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.accent,
  },
  hint: {
    minWidth: tapTarget.min,
    minHeight: tapTarget.min,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintOpen: { backgroundColor: color.hintSoft, borderColor: color.hint },
  hintUnavailable: { opacity: 0.4 },
  hintLabel: { ...typography.label, fontSize: 15, color: color.hint },
  pressed: { opacity: 0.7 },
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
});
