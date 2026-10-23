import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  ContinueCard,
  LockedSnackbar,
  ModulePath,
  useHomeMap,
  useLockedSnackbar,
} from '@/exercises/UnitMap';
import { Game9Card } from '@/game9/ui/Game9Card';
import { shouldShowOnboarding, useProgress } from '@/store';
import { GearIcon } from '@/theme/icons';
import { Screen, TopBar } from '@/theme/Screen';
import { color, radius, spacing, stone, tapTarget, typography } from '@/theme/tokens';

/** Home text may grow up to 200 % (M6-settings AC 42). */
const TEXT_SCALE = 2;

/**
 * Home = the learning-path map (spec §6.1), grouped in three modules (M6-settings §4.8). The map
 * rows come from src/lessons. A fresh install goes to the intro first (M6-settings AC 25).
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const map = useHomeMap();
  const snackbar = useLockedSnackbar();
  const firstLaunch = useProgress(shouldShowOnboarding);
  const open = (lessonId: string) => router.push(`/lesson/${lessonId}`);

  if (firstLaunch) return <Redirect href="/onboarding" />;

  return (
    <Screen backdrop="home">
      <TopBar
        right={
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.open')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <GearIcon color={color.textSecondary} size={24} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.logo} accessible={false}>
          <View style={[styles.stone, styles.blackStone]} />
          <View style={[styles.stone, styles.whiteStone]} />
        </View>
        <Text style={styles.display} accessibilityRole="header" maxFontSizeMultiplier={TEXT_SCALE}>
          {t('app.name')}
        </Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={TEXT_SCALE}>
          {t('home.subtitle')}
        </Text>

        <View style={styles.continueSlot}>
          {!map.hydrated && map.hasContent ? (
            <View style={styles.continueSkeleton} testID="home-continue-skeleton" />
          ) : map.next ? (
            <ContinueCard
              node={map.next}
              titleKey={map.nextTitleKey}
              started={map.started}
              onPress={() => map.next && open(map.next.lesson.id)}
            />
          ) : null}
        </View>

        {/* One header per screen (AC 36): the section title is plain text. */}
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={TEXT_SCALE}>
          {t('home.path.title')}
        </Text>
        <ModulePath
          rows={map.rows}
          hydrated={map.hydrated}
          onOpen={open}
          onLocked={snackbar.show}
        />
        {/* Outside the modules, always visible and open from the start (AC 61). */}
        <View style={styles.game9}>
          <Game9Card onOpen={() => router.push('/game')} />
        </View>
        {map.hydrated && map.hasContent && !map.next ? (
          <Text style={styles.caption} testID="home-all-done" maxFontSizeMultiplier={TEXT_SCALE}>
            {t('home.allDone')}
          </Text>
        ) : null}
        <Text style={styles.caption} maxFontSizeMultiplier={TEXT_SCALE}>
          {t('home.moreSoon')}
        </Text>
      </ScrollView>
      <LockedSnackbar visible={snackbar.visible} />
    </Screen>
  );
}

const STONE_SIZE = 34;

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl + 44 },
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
  subtitle: {
    ...typography.body,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  continueSlot: { marginTop: spacing.lg },
  continueSkeleton: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: color.border,
    opacity: 0.35,
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 18,
    color: color.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  game9: { marginTop: spacing.lg },
  caption: {
    ...typography.caption,
    color: color.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
