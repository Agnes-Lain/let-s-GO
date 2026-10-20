// Explanation player (spec §6.2, ACs 45–58): a few board "slides", one sentence each. Since M5
// (M5-life-death §5.6) the text card is on top, the board below it, Replay under the board.
// The board is display-only; moves play by themselves ~500 ms apart (instantly with Reduce Motion).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoBoard, type CaptureEvent } from '@/board';
import { useReduceMotion } from '@/board/useReduceMotion';
import { explainFrames, type Lesson } from '@/lessons';
import { Button, IconButton } from '@/theme/Button';
import { ChevronIcon, CloseIcon, ReplayIcon } from '@/theme/icons';
import { Screen } from '@/theme/Screen';
import { color, radius, spacing, typography } from '@/theme/tokens';

import { useBoardWidth } from './layout';

/** The explanation text slot above the board: 4 lines, the same in every step (AC 40, §12b: 120 px, not 96). */
export const TEXT_CARD_HEIGHT = 120;

/** Delay before the first move and between moves (ms). */
export const MOVE_INTERVAL = 500;

type Props = {
  lesson: Lesson;
  /** Best stars so far: *Skip to practice* shows only with ≥ 1★. */
  stars: number;
  onClose: () => void;
  onStartPractice: () => void;
};

/** Where the board is inside a step: -1 = start position, k = after move k. */
interface View_ {
  step: number;
  frame: number;
  /** Changes on every step entry / replay: the board is remounted, so nothing animates back. */
  run: number;
}

export function ExplainPlayer({ lesson, stars, onClose, onStartPractice }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const boardWidth = useBoardWidth();
  const steps = useMemo(() => explainFrames(lesson), [lesson]);
  const lastFrame = (step: number) => steps[step].moves.length - 1;

  const [view, setView] = useState<View_>({ step: 0, frame: -1, run: 0 });
  const step = steps[view.step];
  const isLast = view.step === steps.length - 1;

  const enter = (index: number, atEnd: boolean) =>
    setView((v) => ({
      step: index,
      frame: atEnd ? lastFrame(index) : -1,
      run: v.run + 1,
    }));

  // Play the step's moves, one every MOVE_INTERVAL, from the start position.
  useEffect(() => {
    if (view.frame !== -1 || step.moves.length === 0 || reduceMotion) return;
    const timers = step.moves.map((_, k) =>
      setTimeout(() => setView((v) => ({ ...v, frame: k })), MOVE_INTERVAL * (k + 1)),
    );
    return () => timers.forEach(clearTimeout);
    // Restart only on a new step entry / replay, not on each frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.run, view.step, reduceMotion]);

  // Announce the step to screen readers.
  const stepLabel = t('lesson.step.a11y', { current: view.step + 1, total: steps.length });
  const text = t(step.textKey);
  const announced = useRef<number | null>(null);
  useEffect(() => {
    if (announced.current === view.step) return;
    announced.current = view.step;
    AccessibilityInfo.announceForAccessibility(`${stepLabel}. ${text}`);
  }, [view.step, stepLabel, text]);

  // Reduce Motion: no playback, the step's final position is shown at once.
  const shown = reduceMotion && view.frame === -1 ? lastFrame(view.step) : view.frame;
  const frame = shown >= 0 ? step.moves[shown] : null;
  const stones = frame ? frame.cells : step.start;
  const lastCapture: CaptureEvent | null =
    frame && frame.captured.length > 0
      ? { id: shown + 1, color: frame.capturedColor, points: frame.captured }
      : null;

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton label={t('lesson.close')} onPress={onClose} testID="lesson-close">
          <CloseIcon color={color.accent} size={22} />
        </IconButton>
        <View
          style={styles.dots}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={stepLabel}
          testID="lesson-dots"
        >
          {steps.map((_, i) => (
            <View
              key={i}
              testID={i === view.step ? 'lesson-dot-active' : 'lesson-dot'}
              style={[styles.dot, i === view.step && styles.dotActive]}
            />
          ))}
        </View>
        <View style={styles.skipSlot}>
          {stars >= 1 ? (
            <Button
              variant="text"
              label={t('lesson.skip')}
              onPress={onStartPractice}
              testID="lesson-skip"
              style={styles.skip}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.textCard} testID="lesson-text-card">
        <ScrollView>
          <Text style={styles.text} testID="lesson-text">
            {text}
          </Text>
        </ScrollView>
      </View>

      <View style={{ width: boardWidth, height: boardWidth }} testID="lesson-board-area">
        <GoBoard
          key={view.run}
          size={step.size}
          stones={stones}
          width={boardWidth}
          showCoordinates={lesson.coordinates ?? false}
          lastMove={frame ? frame.move : null}
          lastCapture={lastCapture}
          highlights={shown === -1 ? step.highlights : []}
          markers={step.markers}
          testID="lesson-board"
        />
      </View>

      <View style={styles.replayRow}>
        {step.moves.length > 0 ? (
          <Button
            variant="text"
            label={t('lesson.replay')}
            icon={<ReplayIcon color={color.accent} size={18} />}
            onPress={() => enter(view.step, false)}
            testID="lesson-replay"
          />
        ) : null}
      </View>

      <View style={styles.spacer} />

      <View style={styles.buttons}>
        {view.step > 0 ? (
          <Button
            variant="secondary"
            label={t('lesson.back')}
            icon={<ChevronIcon direction="left" color={color.accent} size={18} />}
            onPress={() => enter(view.step - 1, true)}
            testID="lesson-back"
            style={styles.backButton}
          />
        ) : null}
        {isLast ? (
          <Button
            label={t('lesson.startPractice')}
            onPress={onStartPractice}
            testID="lesson-start-practice"
            style={styles.button}
          />
        ) : (
          <Button
            label={t('lesson.next')}
            trailingIcon={<ChevronIcon color={color.onAccent} size={18} />}
            onPress={() => enter(view.step + 1, false)}
            testID="lesson-next"
            style={styles.button}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    position: 'absolute',
    left: 88,
    right: 88,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.border },
  dotActive: { backgroundColor: color.accent },
  skipSlot: { minWidth: 44, alignItems: 'flex-end' },
  skip: { paddingHorizontal: 0 },
  // M5-life-death §5.6 (AC 39–40): the text card sits above the board, in a fixed slot.
  textCard: {
    height: TEXT_CARD_HEIGHT,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  text: { ...typography.body, color: color.textPrimary },
  replayRow: { height: 44, alignItems: 'flex-end', marginTop: spacing.xs },
  spacer: { flex: 1 },
  buttons: { flexDirection: 'row', gap: spacing.md },
  button: { flex: 1 },
  backButton: { flexShrink: 0, paddingHorizontal: spacing.lg },
});
