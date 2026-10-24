// Landing page (docs/specs/M6-settings-onboarding-a11y.md §12c "Landing design", variant "A + board",
// PO changes 2026-10-24). On 360×740: logo y 148–192 (drawn 1.35×), name y 200–234, one intro
// line in a 3-line slot y 246–318 (fr wraps), a decorative 180 px board y 324–504, the CTA
// y 528–580, and the mountain ridges below y 600 left uncovered. With large text the content scrolls in the same
// order. UI only: the screen decides where the buttons go.
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoBoard, stonesFromSetup } from '@/board';
import { Button } from '@/theme/Button';
import { GearIcon } from '@/theme/icons';
import { Screen, TopBar } from '@/theme/Screen';
import { color, radius, spacing, stone, tapTarget, textScale, typography } from '@/theme/tokens';

type LandingProps = {
  onStart: () => void;
  onOpenSettings: () => void;
};

/** Black c3, d4; white d3, c2: a quiet, legal position (nothing in atari). */
const LANDING_STONES = stonesFromSetup(5, { B: ['c3', 'd4'], W: ['d3', 'c2'] });
const BOARD = 180;
/** The top bar is 52 px; the logo box starts at y 148. */
const LOGO_TOP = 148 - 52;
/** A 3-line slot (fr wraps to 3): the board sits at the same place in every language. */
const INTRO_MIN_HEIGHT = 3 * typography.body.lineHeight;

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
        <View
          style={styles.logo}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
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
        <Text style={styles.intro} maxFontSizeMultiplier={textScale.page} testID="landing-intro">
          {t('home.intro')}
        </Text>
        {/* Decorative: not touchable, hidden from screen readers (§12c). */}
        <View
          style={styles.board}
          pointerEvents="none"
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="landing-board"
        >
          <GoBoard
            size={5}
            stones={LANDING_STONES}
            width={BOARD}
            showCoordinates={false}
            sound={false}
            announce={false}
            testID="landing-go-board"
          />
        </View>
        <Button
          label={t('home.start')}
          onPress={onStart}
          testID="landing-start"
          style={styles.cta}
        />
      </ScrollView>
    </Screen>
  );
}

const STONE_SIZE = 34;

const styles = StyleSheet.create({
  content: { paddingTop: LOGO_TOP, paddingBottom: spacing.xxl, alignItems: 'center' },
  iconButton: {
    width: tapTarget.min,
    height: tapTarget.min,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  // The existing two-stone mark, drawn 1.35× in its 56×44 box (as in the mockup).
  logo: { width: 56, height: 44, transform: [{ scale: 1.35 }] },
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
  display: {
    ...typography.display,
    color: color.textPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  intro: {
    ...typography.body,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 300,
    minHeight: INTRO_MIN_HEIGHT,
  },
  board: { marginTop: 6, width: BOARD, height: BOARD },
  // Full width with 24 px side margins (the screen gutter is 16).
  cta: {
    minHeight: 52,
    alignSelf: 'stretch',
    marginHorizontal: spacing.sm,
    marginTop: spacing.xl,
  },
});
