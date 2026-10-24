import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/theme/Button';
import { color, radius, spacing, textScale } from '@/theme/tokens';

export type FeedbackTone = 'success' | 'error' | 'hint';
export interface FeedbackText {
  text: string;
  tone: FeedbackTone;
}

export interface FrameAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}

const DOT: Record<FeedbackTone, string> = {
  success: color.success,
  error: color.error,
  hint: color.hint,
};

/**
 * The 72 px feedback card: the slot is always there, so nothing jumps (AC 67). `height` makes the
 * fixed slot taller (the 9×9 game's two note lines, M6-game-coaching §5.1).
 */
export function FeedbackCard({
  lines,
  height,
  liveRegion = true,
}: {
  lines: readonly FeedbackText[];
  height?: number;
  /**
   * Android live region. Off where the screen announces the feedback itself (ExerciseView,
   * SequenceRunner), so it is heard once (M6-settings AC 39).
   */
  liveRegion?: boolean;
}) {
  return (
    <View
      style={height === undefined ? styles.feedback : [styles.feedback, { height }]}
      testID="practice-feedback"
      accessible={lines.length > 0}
      accessibilityLiveRegion={liveRegion ? 'polite' : 'none'}
      accessibilityLabel={lines.map((l) => l.text).join(' ')}
    >
      <ScrollView>
        {lines.map((line, i) => (
          <View key={i} style={styles.line} testID={`practice-feedback-${line.tone}`}>
            {i === 0 || lines[i - 1].tone !== line.tone ? (
              <View style={[styles.dot, { backgroundColor: DOT[line.tone] }]} />
            ) : (
              <View style={styles.dotSpace} />
            )}
            <Text
              maxFontSizeMultiplier={textScale.hud}
              style={i === 0 ? styles.main : styles.secondary}
            >
              {line.text}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Below the prompt: the exercise body (board + controls), the feedback card, then one primary
 * button pinned at the bottom (absent when there is nothing to confirm).
 */
export function ExerciseFrame({
  children,
  feedback,
  action,
}: {
  children: ReactNode;
  feedback: readonly FeedbackText[];
  action: FrameAction | null;
}) {
  return (
    <View style={styles.frame}>
      {children}
      {/* ExerciseView announces the feedback (AC 39): no second Android live-region read. */}
      <FeedbackCard lines={feedback} liveRegion={false} />
      <View style={styles.spacer} />
      {action ? (
        <Button
          maxFontSizeMultiplier={textScale.hud}
          label={action.label}
          onPress={action.onPress}
          disabled={action.disabled}
          testID={action.testID}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, gap: spacing.sm, alignItems: 'stretch' },
  feedback: {
    height: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  dotSpace: { width: 8 },
  main: { flex: 1, fontSize: 14, lineHeight: 19, color: color.textPrimary },
  secondary: { flex: 1, fontSize: 12, lineHeight: 17, color: color.textSecondary },
  spacer: { flex: 1 },
});
