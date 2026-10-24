// The first-time intro (docs/specs/M6-settings-onboarding-a11y.md §5.2, AC 24–34, 46–49, §12c):
// step 1 Welcome (Next), step 2 "Try placing a stone" (Done). Opened from the landing page's
// "Start learning"; Done and Skip end on the learning page. Replayable from Settings (`?replay=1`).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { GoBoard, stonesFromSetup } from '@/board';
import { TouchDemo } from '@/exercises/TouchDemo';
import { LEARN_ROUTE } from '@/exercises/navigation';
import { progressStore } from '@/store';
import { Button } from '@/theme/Button';
import { Screen } from '@/theme/Screen';
import { color, radius, spacing, tapTarget, typography } from '@/theme/tokens';

export const ONBOARDING_STEPS = 2;
/** Step 1's static example (§5.3): Black b3, c3; White c4, d3. Nothing in atari. */
const WELCOME_STONES = stonesFromSetup(5, { B: ['b3', 'c3'], W: ['c4', 'd3'] });
const WELCOME_BOARD = 200;
const DEMO_BOARD_MAX = 300;
/** Pages allow text up to 200 % and scroll (AC 42). */
const TEXT_SCALE = 2;

type Step = 1 | 2;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const replaying = replay === '1';
  const { width: windowWidth } = useWindowDimensions();
  const [step, setStep] = useState<Step>(1);

  const title = t(`onboarding.${step}.title`);
  const stepLabel = t('onboarding.step', { n: step, total: ONBOARDING_STEPS });

  // Every step says its title and "Step n of 2" (AC 32).
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${title}. ${stepLabel}`);
  }, [title, stepLabel]);

  /**
   * Skip, Back on step 1 (AC 27) and Done (AC 28) all end on the learning page (§12c.3–4), which
   * replaces the intro. Only the first-time intro marks itself as seen; a replay changes nothing.
   */
  const leave = () => {
    if (!replaying) progressStore.getState().setFlag('onboardingSeen');
    if (router.canGoBack()) router.dismissTo(LEARN_ROUTE);
    else router.replace(LEARN_ROUTE);
  };

  // System back (AC 26): step 2 → step 1; on step 1 it is Skip.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 2) setStep(1);
      else leave();
      return true;
    });
    return () => sub.remove();
  });

  const demoWidth = Math.min(DEMO_BOARD_MAX, windowWidth - 2 * spacing.lg);

  return (
    <Screen backdrop="home">
      <View style={styles.topBar}>
        <Pressable
          onPress={leave}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skip')}
          testID="onboarding-skip"
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
        >
          <Text style={styles.skipLabel} maxFontSizeMultiplier={TEXT_SCALE}>
            {t('onboarding.skip')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, step === 2 && styles.contentDemo]}
        testID={`onboarding-step-${step}`}
      >
        <Text
          style={step === 1 ? styles.display : styles.title}
          accessibilityRole="header"
          maxFontSizeMultiplier={TEXT_SCALE}
        >
          {title}
        </Text>
        {step === 1 ? (
          <>
            <Text style={styles.body} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('onboarding.1.concept')}
            </Text>
            <Text style={styles.body} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('onboarding.1.body')}
            </Text>
            <View style={styles.board}>
              <GoBoard
                size={5}
                stones={WELCOME_STONES}
                width={WELCOME_BOARD}
                sound={false}
                accessibilityLabel={t('onboarding.a11y.board1')}
                testID="onboarding-welcome-board"
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.body} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('onboarding.2.body')}
            </Text>
            <Text style={styles.hint} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('onboarding.2.hint')}
            </Text>
            <TouchDemo width={demoWidth} label={t('onboarding.a11y.demo')} />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={stepLabel}
          testID="onboarding-dots"
        >
          {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
            <View key={i} style={[styles.dot, i + 1 === step && styles.dotCurrent]} />
          ))}
        </View>
        {step === 1 ? (
          <Button
            label={t('onboarding.next')}
            onPress={() => setStep(2)}
            testID="onboarding-next"
            style={styles.button}
          />
        ) : (
          // Never blocked: enabled before and after the demo is used (AC 31).
          <Button
            label={t('onboarding.done')}
            onPress={leave}
            testID="onboarding-finish"
            style={styles.button}
          />
        )}
      </View>
    </Screen>
  );
}

const DOT = 8;

const styles = StyleSheet.create({
  topBar: { height: 56, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  skip: {
    minWidth: tapTarget.min,
    minHeight: tapTarget.min,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  skipLabel: { ...typography.label, color: color.accent },
  pressed: { opacity: 0.6 },
  scroll: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  // Step 2 fits a 360×740 screen without scrolling (AC 33): tighter gaps, a smaller title.
  contentDemo: { gap: spacing.sm, paddingBottom: 0 },
  display: { ...typography.display, color: color.textPrimary },
  title: { ...typography.title, color: color.textPrimary },
  body: { ...typography.body, color: color.textPrimary },
  hint: { ...typography.body, color: color.textSecondary },
  board: { alignItems: 'center', marginTop: spacing.sm },
  footer: { gap: spacing.md, paddingTop: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1,
    borderColor: color.accent,
  },
  dotCurrent: { backgroundColor: color.accent },
  button: { minHeight: 52 },
});
