import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, radius, spacing, tapTarget, typography } from './tokens';

type Variant = 'primary' | 'secondary' | 'danger' | 'text';
type ButtonStyle = StyleProp<ViewStyle>;

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Drawn before the label (decorative). */
  icon?: ReactNode;
  /** Drawn after the label (decorative). */
  trailingIcon?: ReactNode;
  testID?: string;
  style?: ButtonStyle;
  accessibilityLabel?: string;
  /** Text-size cap (M6-settings AC 42): 2 on pages and sheets, 1.3 in game/lesson HUDs. */
  maxFontSizeMultiplier?: number;
};

/**
 * Primary (accent), secondary (outlined surface), danger (outlined, error colour) or text button;
 * 48 px high (text: 44).
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  trailingIcon,
  testID,
  style,
  accessibilityLabel,
  maxFontSizeMultiplier = 2,
}: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.row}>
        {icon}
        <Text
          style={[
            styles.label,
            variant === 'primary'
              ? styles.onAccent
              : variant === 'danger'
                ? styles.onDanger
                : styles.onSurface,
          ]}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          numberOfLines={2}
        >
          {label}
        </Text>
        {trailingIcon}
      </View>
    </Pressable>
  );
}

type IconButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
  testID?: string;
};

/** 44×44 icon-only button (✕, gear…); the label is for screen readers. */
export function IconButton({ label, onPress, children, testID }: IconButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    minWidth: tapTarget.min,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primary: { backgroundColor: color.accent },
  secondary: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
  danger: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.error },
  text: { minHeight: tapTarget.min, paddingHorizontal: spacing.sm },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  label: { ...typography.label, flexShrink: 1, textAlign: 'center' },
  onAccent: { color: color.onAccent },
  onSurface: { color: color.accent },
  onDanger: { color: color.error },
  icon: {
    width: tapTarget.min,
    height: tapTarget.min,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
