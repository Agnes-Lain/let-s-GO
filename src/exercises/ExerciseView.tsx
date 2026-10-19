// One exercise of a practice set (spec §6.3): top bar (✕, progress, Hint), prompt, runner.
// Remounted for every exercise, so each one starts with fresh attempts.
import { useEffect, useMemo, useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Exercise, Lesson, Outcome, PlayBotExercise } from '@/lessons';
import { color, radius, spacing, typography } from '@/theme/tokens';

import {
  INITIAL_ATTEMPTS,
  attemptsReducer,
  hasHint,
  outcomeOf,
  type AttemptState,
} from './attempts';
import type { FeedbackText, FrameAction } from './ExerciseFrame';
import { ExerciseTopBar } from './ExerciseTopBar';
import { practiceBoardWidth } from './layout';
import { ChoiceRunner } from './runners/ChoiceRunner';
import { CountRunner } from './runners/CountRunner';
import { PlayBotRunner } from './runners/PlayBotRunner';
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
function feedbackFor(exercise: MoveExercise, attempts: AttemptState, t: T): FeedbackText[] {
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

type MoveExercise = Exclude<Exercise, PlayBotExercise>;

/** One exercise: a Capture Go game (PlayBotRunner) or a move / answer exercise. */
export function ExerciseView(props: Props) {
  const exercise = props.lesson.exercises[props.index];
  if (exercise.type === 'play-bot') return <PlayBotRunner exercise={exercise} {...props} />;
  return <MoveExerciseView exercise={exercise} {...props} />;
}

function MoveExerciseView({
  lesson,
  index,
  onClose,
  onDone,
  exercise,
}: Props & { exercise: MoveExercise }) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
      <ExerciseTopBar
        index={index}
        total={total}
        onClose={onClose}
        hint={{
          available: hasHint(exercise),
          enabled: hintEnabled,
          open: attempts.hintOpen,
          onPress: () => dispatch({ type: 'hint' }),
        }}
      />

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
