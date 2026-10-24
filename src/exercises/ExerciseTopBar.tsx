// The practice top bar (spec M3 §6.3): ✕, one segment per exercise, Hint. Shared by the move
// exercises (ExerciseView) and the Capture Go games (PlayBotRunner).
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/theme/Button';
import { CloseIcon } from '@/theme/icons';
import { color, radius, spacing, tapTarget, textScale, typography } from '@/theme/tokens';

type Props = {
  index: number;
  total: number;
  onClose: () => void;
  /** Omitted when the screen has its own Hint button (the sequence runner, M5 AC 30). */
  hint?: {
    /** The exercise has a hint at all (otherwise the button is dimmed). */
    available: boolean;
    enabled: boolean;
    open: boolean;
    onPress: () => void;
  };
};

export function ExerciseTopBar({ index, total, onClose, hint }: Props) {
  const { t } = useTranslation();
  return (
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
        {Array.from({ length: total }, (_, i) => (
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
      {hint ? (
        <Pressable
          testID="practice-hint"
          onPress={hint.onPress}
          disabled={!hint.enabled}
          accessibilityRole="button"
          accessibilityLabel={t('practice.hint')}
          accessibilityState={{ disabled: !hint.enabled, expanded: hint.open }}
          style={({ pressed }) => [
            styles.hint,
            hint.open && styles.hintOpen,
            !hint.available && styles.hintUnavailable,
            pressed && styles.pressed,
          ]}
        >
          <Text maxFontSizeMultiplier={textScale.hud} style={styles.hintLabel} numberOfLines={1}>
            {t('practice.hint')}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.hintSlot} />
      )}
    </View>
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
  hintSlot: { width: tapTarget.min },
  hintOpen: { backgroundColor: color.hintSoft, borderColor: color.hint },
  hintUnavailable: { opacity: 0.4 },
  hintLabel: { ...typography.label, fontSize: 15, color: color.hint },
  pressed: { opacity: 0.7 },
});
