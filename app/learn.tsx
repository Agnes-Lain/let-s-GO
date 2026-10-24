import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  ContinueCard,
  LockedSnackbar,
  ModulePath,
  useHomeMap,
  useLockedSnackbar,
} from '@/exercises/UnitMap';
import { useGoToLanding } from '@/exercises/navigation';
import { Game9Card } from '@/game9/ui/Game9Card';
import { GearIcon } from '@/theme/icons';
import { Screen, TopBar } from '@/theme/Screen';
import { color, radius, spacing, tapTarget, typography } from '@/theme/tokens';

/** Page text may grow up to 200 % (M6-settings AC 42). */
const TEXT_SCALE = 2;

/**
 * The learning page (M6-settings §12c.2): the Continue card, the learning-path map (spec §6.1) in
 * three modules (§4.8) and the 9×9 card. Lessons, results and the 9×9 game return here; Back goes
 * to the landing page (§12c.5). The map rows come from src/lessons.
 */
export default function LearnScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const backToLanding = useGoToLanding();
  const map = useHomeMap();
  const snackbar = useLockedSnackbar();
  const open = (lessonId: string) => router.push(`/lesson/${lessonId}`);

  return (
    <Screen backdrop="home">
      <TopBar
        showBack
        onBack={backToLanding}
        backTestID="learn-back"
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
        {/* The page title is the one header (AC 36); it wraps, unlike the top-bar slot. */}
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={TEXT_SCALE}>
          {t('home.path.title')}
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

        <ModulePath
          rows={map.rows}
          hydrated={map.hydrated}
          onOpen={open}
          onLocked={snackbar.show}
        />
        {/* Outside the modules, always visible and open from the start (AC 61). */}
        <View style={styles.game9}>
          <Game9Card onOpen={() => router.push('/game')} />
          {/* 13×13 right below (M6b §13, PO 2026-10-25): locked until any 9×9 win. */}
          <Game9Card size={13} onOpen={() => router.push('/game?size=13')} />
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
  title: { ...typography.title, color: color.textPrimary },
  continueSlot: { marginTop: spacing.md, marginBottom: spacing.lg },
  continueSkeleton: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: color.border,
    opacity: 0.35,
  },
  game9: { marginTop: spacing.lg, gap: spacing.sm },
  caption: {
    ...typography.caption,
    color: color.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
