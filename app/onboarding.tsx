// The first-time intro (docs/specs/M6-settings-onboarding-a11y.md §5.2, AC 24–34, 46–49, §12c):
// step 1 Welcome (Next), step 2 "Try placing a stone" (Next), step 3 "Your settings" (Done). The
// steps are pages of a horizontal pager: a swipe or Next moves between them. Opened from the
// landing page's "Start learning"; Done and Skip end on the learning page. Replayable from
// Settings (`?replay=1`).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { GoBoard, stonesFromSetup } from '@/board';
import { useReduceMotion } from '@/board/useReduceMotion';
import { TouchDemo } from '@/exercises/TouchDemo';
import { LEARN_ROUTE } from '@/exercises/navigation';
import { progressStore } from '@/store';
import { Button } from '@/theme/Button';
import { Screen } from '@/theme/Screen';
import { GearIcon } from '@/theme/icons';
import { color, radius, spacing, tapTarget, typography } from '@/theme/tokens';

export const ONBOARDING_STEPS = 3;
/** Step 1's static example (§5.3): Black b3, c3; White c4, d3. Nothing in atari. */
const WELCOME_STONES = stonesFromSetup(5, { B: ['b3', 'c3'], W: ['c4', 'd3'] });
const WELCOME_BOARD = 200;
const DEMO_BOARD_MAX = 300;
/** Pages allow text up to 200 % and scroll (AC 42). */
const TEXT_SCALE = 2;

type Step = 1 | 2 | 3;
/** Step 3 lists what the Settings page holds, in its order. */
const SETTINGS_ITEMS = ['language', 'sound', 'games', 'intro', 'reset'] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const replaying = replay === '1';
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState<Step>(1);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  /** Pages fill the pager; before its first layout, the window width stands in. */
  const [pagerWidth, setPagerWidth] = useState(0);
  const pageWidth = pagerWidth || windowWidth;
  /** The page a Next/Back scroll is heading to; scroll events on the way there are ignored. */
  const scrollingTo = useRef<Step | null>(null);
  /**
   * While a finger is on the step 2 board, neither the pager nor the page scrolls: the board stays
   * still, so sliding to another crossing or off the board works.
   */
  const [boardTouched, setBoardTouched] = useState(false);

  const title = t(`onboarding.${step}.title`);
  const stepLabel = t('onboarding.step', { n: step, total: ONBOARDING_STEPS });

  // Every step says its title and "Step n of 3" (AC 32).
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

  const goTo = (next: Step) => {
    scrollingTo.current = next;
    setStep(next);
    pager.current?.scrollTo({ x: (next - 1) * pageWidth, animated: !reduceMotion });
  };

  // A swipe that lands on another page makes it the step.
  const onPagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / pageWidth) + 1;
    const landed = Math.min(Math.max(page, 1), ONBOARDING_STEPS) as Step;
    if (scrollingTo.current !== null) {
      if (landed === scrollingTo.current) scrollingTo.current = null;
      return;
    }
    if (landed !== step) setStep(landed);
  };

  // System back (AC 26): goes one step back; on step 1 it is Skip.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1) goTo((step - 1) as Step);
      else leave();
      return true;
    });
    return () => sub.remove();
  });

  const demoWidth = Math.min(DEMO_BOARD_MAX, windowWidth - 2 * spacing.lg);
  const releaseBoard = () => setBoardTouched(false);

  /** One page of the pager; only the current one reaches screen readers. */
  const page = (n: Step, children: ReactNode) => {
    const current = n === step;
    return (
      <View
        style={[styles.page, { width: pageWidth }]}
        aria-hidden={!current}
        accessibilityElementsHidden={!current}
        importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
      >
        <ScrollView
          style={styles.scroll}
          scrollEnabled={!boardTouched}
          contentContainerStyle={[styles.content, n === 2 && styles.contentDemo]}
          testID={`onboarding-step-${n}`}
        >
          <Text
            style={n === 1 ? styles.display : styles.title}
            accessibilityRole="header"
            maxFontSizeMultiplier={TEXT_SCALE}
          >
            {t(`onboarding.${n}.title`)}
          </Text>
          {children}
        </ScrollView>
      </View>
    );
  };

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
        ref={pager}
        horizontal
        pagingEnabled
        scrollEnabled={!boardTouched}
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setPagerWidth(e.nativeEvent.layout.width)}
        onScroll={onPagerScroll}
        // A finger on the pager ends any Next/Back scroll: from then on, its swipe counts.
        onTouchStart={() => (scrollingTo.current = null)}
        scrollEventThrottle={16}
        style={styles.pager}
        testID="onboarding-pager"
      >
        {page(
          1,
          <>
            <Text style={styles.body} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('onboarding.1.body')}
            </Text>
            <Text style={styles.body} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('onboarding.1.concept')}
            </Text>
            <Text style={styles.body} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('onboarding.1.rules')}
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
          </>,
        )}
        {page(
          2,
          <>
            <Text style={styles.body} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('onboarding.2.body')}
            </Text>
            <Text style={styles.hint} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('onboarding.2.hint')}
            </Text>
            <View
              onTouchStart={() => setBoardTouched(true)}
              onTouchEnd={releaseBoard}
              onTouchCancel={releaseBoard}
              testID="onboarding-demo-area"
            >
              <TouchDemo width={demoWidth} label={t('onboarding.a11y.demo')} />
            </View>
          </>,
        )}
        {page(
          3,
          <>
            <View style={styles.gearRow}>
              <View style={styles.gear}>
                <GearIcon color={color.accent} size={32} />
              </View>
              <Text style={[styles.body, styles.gearText]} maxFontSizeMultiplier={TEXT_SCALE}>
                {t('onboarding.3.body')}
              </Text>
            </View>
            <View style={styles.list} testID="onboarding-settings-list">
              {SETTINGS_ITEMS.map((item) => (
                <View key={item} style={styles.listItem}>
                  <View style={styles.bullet} aria-hidden />
                  <Text style={[styles.body, styles.gearText]} maxFontSizeMultiplier={TEXT_SCALE}>
                    {t(`onboarding.3.${item}`)}
                  </Text>
                </View>
              ))}
            </View>
          </>,
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
        {step < ONBOARDING_STEPS ? (
          <Button
            label={t('onboarding.next')}
            onPress={() => goTo((step + 1) as Step)}
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
  // Full-bleed, so a page slides out past the screen's side padding; each page keeps it inside.
  pager: { flex: 1, marginHorizontal: -spacing.lg },
  page: { paddingHorizontal: spacing.lg },
  scroll: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  // Step 2 fits a 360×740 screen without scrolling (AC 33): tighter gaps, a smaller title.
  contentDemo: { gap: spacing.sm, paddingBottom: 0 },
  display: { ...typography.display, color: color.textPrimary },
  title: { ...typography.title, color: color.textPrimary },
  body: { ...typography.body, color: color.textPrimary },
  hint: { ...typography.body, color: color.textSecondary },
  board: { alignItems: 'center', marginTop: spacing.sm },
  gearRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  gear: {
    width: tapTarget.min,
    height: tapTarget.min,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearText: { flex: 1 },
  list: { gap: spacing.xs },
  listItem: { flexDirection: 'row', gap: spacing.sm },
  // Centred on the first line of body text.
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: (typography.body.lineHeight - 6) / 2,
    backgroundColor: color.accent,
  },
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
