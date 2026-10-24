import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ChevronIcon } from './icons';
import { Landscape } from './Landscape';
import { color, spacing, tapTarget, textScale, typography } from './tokens';

type ScreenProps = {
  /** `home` draws mist + mountains; every other screen gets the thin mist only. */
  backdrop?: 'home' | 'mist';
  children: ReactNode;
};

/** Page frame: rice-paper background, decorative landscape, safe-area top inset, 16px gutters. */
export function Screen({ backdrop = 'mist', children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <Landscape variant={backdrop} />
      <View
        style={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** Go back if there is history, otherwise go to Home (deep links, web reloads). */
export function useGoBack() {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };
}

type TopBarProps = {
  title?: string;
  /** Show the "‹ Back" button on the left. */
  showBack?: boolean;
  /** Where Back goes; default: the previous screen, or the landing page without history. */
  onBack?: () => void;
  backTestID?: string;
  /** Optional element on the right (e.g. the settings button). */
  right?: ReactNode;
};

export function TopBar({ title, showBack = false, onBack, backTestID, right }: TopBarProps) {
  const { t } = useTranslation();
  const goBack = useGoBack();
  return (
    <View style={styles.topBar}>
      {title ? (
        <Text
          style={styles.topBarTitle}
          accessibilityRole="header"
          numberOfLines={1}
          maxFontSizeMultiplier={textScale.page}
        >
          {title}
        </Text>
      ) : null}
      {showBack ? (
        <Pressable
          onPress={onBack ?? goBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          testID={backTestID}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ChevronIcon direction="left" color={color.accent} size={20} />
          <Text style={styles.backLabel} maxFontSizeMultiplier={textScale.page}>
            {t('common.back')}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: {
    ...typography.label,
    fontSize: 17,
    color: color.textPrimary,
    position: 'absolute',
    left: 88,
    right: 88,
    textAlign: 'center',
  },
  back: {
    minWidth: tapTarget.min,
    minHeight: tapTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  backLabel: { ...typography.label, color: color.accent },
  spacer: { width: tapTarget.min, height: tapTarget.min },
  pressed: { opacity: 0.6 },
});
