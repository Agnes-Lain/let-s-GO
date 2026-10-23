// One settings row that is a switch (docs/specs/M6-settings-onboarding-a11y.md AC 17): the whole
// row is the pressable (≥ 52 px), the drawn track is decorative. Used by Settings and the 9×9 picker.
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, radius, spacing, typography } from './tokens';

export const SWITCH_ROW_MIN_HEIGHT = 52;
const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const THUMB = 20;

interface SwitchRowProps {
  title: string;
  /** Under the title; also the screen-reader hint. */
  description?: string;
  value: boolean;
  onChange(next: boolean): void;
  /** Shown as it is but dimmed; pressing changes nothing. */
  disabled?: boolean;
  /** An extra line under the description (e.g. why the switch is locked). */
  note?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  maxFontSizeMultiplier?: number;
}

export function SwitchRow({
  title,
  description,
  value,
  onChange,
  disabled = false,
  note,
  testID,
  style,
  maxFontSizeMultiplier = 2,
}: SwitchRowProps) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : () => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed, style]}
    >
      <View style={styles.text}>
        <Text style={styles.title} maxFontSizeMultiplier={maxFontSizeMultiplier}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {description}
          </Text>
        ) : null}
        {note ? (
          <Text
            style={styles.description}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            testID={testID ? `${testID}-note` : undefined}
          >
            {note}
          </Text>
        ) : null}
      </View>
      <View
        style={[styles.track, value ? styles.trackOn : styles.trackOff, disabled && styles.dim]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID={testID ? `${testID}-track` : undefined}
      >
        <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: SWITCH_ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pressed: { backgroundColor: color.background },
  text: { flex: 1, minWidth: 0 },
  title: { ...typography.label, color: color.textPrimary },
  description: { ...typography.caption, color: color.textSecondary, marginTop: 2 },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    justifyContent: 'center',
    paddingHorizontal: (TRACK_HEIGHT - THUMB) / 2 - 1,
    borderWidth: 1,
  },
  trackOn: { backgroundColor: color.accent, borderColor: color.accent },
  // Off: the border colour fill (spec §5.1) with a textSecondary outline, so the off track keeps
  // ≥ 3:1 against the row (AC 41; border on surface alone is 1.3:1).
  trackOff: { backgroundColor: color.border, borderColor: color.textSecondary },
  dim: { opacity: 0.5 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: color.surface,
  },
  thumbOn: { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start', borderWidth: 1, borderColor: color.textSecondary },
});
