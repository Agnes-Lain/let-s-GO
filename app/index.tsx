import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChevronIcon, GearIcon } from '@/theme/icons';
import { Screen, TopBar } from '@/theme/Screen';
import { color, radius, spacing, stone, tapTarget, typography } from '@/theme/tokens';

const FIRST_LESSON_ID = 'u01-board';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

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
        <Text style={styles.display} accessibilityRole="header">
          {t('app.name')}
        </Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

        <Text style={styles.sectionTitle} accessibilityRole="header">
          {t('home.path.title')}
        </Text>
        <Pressable
          onPress={() => router.push(`/lesson/${FIRST_LESSON_ID}`)}
          accessibilityRole="button"
          accessibilityLabel={t('home.unit1.title')}
          accessibilityHint={t('home.unit.comingSoon')}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.unitDot} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{t('home.unit1.title')}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{t('home.unit.comingSoon')}</Text>
            </View>
          </View>
          <ChevronIcon color={color.textSecondary} size={22} />
        </Pressable>
        <Text style={styles.caption}>{t('home.moreSoon')}</Text>
      </ScrollView>
    </Screen>
  );
}

const STONE_SIZE = 44;

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  iconButton: {
    width: tapTarget.min,
    height: tapTarget.min,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  logo: { width: 72, height: 56, alignSelf: 'center', marginTop: 20, marginBottom: spacing.md },
  stone: {
    position: 'absolute',
    top: 6,
    width: STONE_SIZE,
    height: STONE_SIZE,
    borderRadius: STONE_SIZE / 2,
  },
  blackStone: { left: 4, backgroundColor: stone.black },
  whiteStone: {
    left: 26,
    backgroundColor: stone.white,
    borderWidth: 1,
    borderColor: stone.whiteEdge,
  },
  display: { ...typography.display, color: color.textPrimary, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  sectionTitle: {
    ...typography.title,
    color: color.textPrimary,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  card: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  unitDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: stone.black },
  cardBody: { flex: 1, alignItems: 'flex-start' },
  cardTitle: { ...typography.label, color: color.textPrimary },
  badge: {
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: color.badge,
  },
  badgeLabel: { ...typography.caption, color: color.onBadge },
  caption: { ...typography.caption, color: color.textSecondary, marginTop: 10 },
});
