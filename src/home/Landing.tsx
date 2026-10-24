// Landing page placeholder (docs/specs/M6-settings-onboarding-a11y.md §12c.1): logo, app name, one
// intro line, "Start learning" and the Settings entry. Kept in one component so the PO-approved
// design can replace it later. UI only: the screen decides where the buttons go.
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/theme/Button';
import { GearIcon } from '@/theme/icons';
import { Screen, TopBar } from '@/theme/Screen';
import { color, radius, spacing, stone, tapTarget, textScale, typography } from '@/theme/tokens';

type LandingProps = {
  onStart: () => void;
  onOpenSettings: () => void;
};

export function Landing({ onStart, onOpenSettings }: LandingProps) {
  const { t } = useTranslation();
  return (
    <Screen backdrop="home">
      <TopBar
        right={
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel={t('settings.open')}
            testID="landing-settings"
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <GearIcon color={color.textSecondary} size={24} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content} testID="landing">
        <View style={styles.logo} accessible={false}>
          <View style={[styles.stone, styles.blackStone]} />
          <View style={[styles.stone, styles.whiteStone]} />
        </View>
        <Text
          style={styles.display}
          accessibilityRole="header"
          maxFontSizeMultiplier={textScale.page}
        >
          {t('app.name')}
        </Text>
        <Text style={styles.intro} maxFontSizeMultiplier={textScale.page}>
          {t('home.subtitle')}
        </Text>
      </ScrollView>
      <Button label={t('home.start')} onPress={onStart} testID="landing-start" style={styles.cta} />
    </Screen>
  );
}

const STONE_SIZE = 34;

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingBottom: spacing.xxl },
  iconButton: {
    width: tapTarget.min,
    height: tapTarget.min,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  logo: { width: 56, height: 44, alignSelf: 'center', marginBottom: spacing.sm },
  stone: {
    position: 'absolute',
    top: 5,
    width: STONE_SIZE,
    height: STONE_SIZE,
    borderRadius: STONE_SIZE / 2,
  },
  blackStone: { left: 3, backgroundColor: stone.black },
  whiteStone: {
    left: 19,
    backgroundColor: stone.white,
    borderWidth: 1,
    borderColor: stone.whiteEdge,
  },
  display: { ...typography.display, color: color.textPrimary, textAlign: 'center' },
  intro: {
    ...typography.body,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cta: { minHeight: 52 },
});
