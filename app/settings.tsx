import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import appConfig from '../app.json';
import { useOsReduceMotion } from '@/board/useReduceMotion';
import { setLanguageChoice, useLanguageChoice, type LanguageChoice } from '@/i18n';
import { progressStore, settingsStore, useProgress, useSettings } from '@/store';
import { CheckIcon, ChevronIcon } from '@/theme/icons';
import { Screen, TopBar } from '@/theme/Screen';
import { Sheet } from '@/theme/Sheet';
import { SwitchRow } from '@/theme/SwitchRow';
import { color, radius, spacing, typography } from '@/theme/tokens';

const LANGUAGE_OPTIONS: { choice: LanguageChoice; labelKey: string }[] = [
  { choice: 'system', labelKey: 'settings.language.system' },
  { choice: 'zh-CN', labelKey: 'settings.language.zh' },
  { choice: 'en', labelKey: 'settings.language.en' },
  { choice: 'fr', labelKey: 'settings.language.fr' },
];

/** How long the "Progress erased." line stays (ms, spec §5.1). */
export const RESET_DONE_MS = 4000;
/** Erase keeps these flags (spec §3): the atari switch and the seen intro. */
const KEPT_FLAGS = ['atariHintsOff', 'onboardingSeen'] as const;
/** Pages allow text up to 200 % and scroll (AC 42). */
const TEXT_SCALE = 2;
/** The legal notice and privacy page (site/legal/, GitHub Pages); `#<language>` opens its section. */
export const LEGAL_URL = 'https://agnes-lain.github.io/let-s-GO/legal/';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const currentChoice = useLanguageChoice();
  const router = useRouter();
  const sound = useSettings((s) => s.sound);
  const appReduceMotion = useSettings((s) => s.reduceMotion);
  const osReduceMotion = useOsReduceMotion() === true;
  const atariHintsOff = useProgress((s) => s.flags.atariHintsOff === true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [erasedAt, setErasedAt] = useState(0);

  useEffect(() => {
    if (erasedAt === 0) return;
    const timer = setTimeout(() => setErasedAt(0), RESET_DONE_MS);
    return () => clearTimeout(timer);
  }, [erasedAt]);

  const erase = () => {
    progressStore.getState().reset({ keepFlags: KEPT_FLAGS });
    setSheetOpen(false);
    setErasedAt(Date.now());
    AccessibilityInfo.announceForAccessibility(t('settings.reset.done'));
  };

  const caption = (text: string) => (
    <Text style={styles.sectionCaption} maxFontSizeMultiplier={TEXT_SCALE}>
      {text}
    </Text>
  );

  return (
    <Screen>
      <TopBar showBack title={t('settings.title')} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        testID="settings-scroll"
      >
        {caption(t('settings.language'))}
        <View style={styles.list}>
          {LANGUAGE_OPTIONS.map(({ choice, labelKey }, index) => {
            const selected = choice === currentChoice;
            const label = t(labelKey);
            return (
              <Pressable
                key={choice}
                onPress={() => setLanguageChoice(choice)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.rowDivider,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.rowLabel} maxFontSizeMultiplier={TEXT_SCALE}>
                  {label}
                </Text>
                {selected ? <CheckIcon color={color.accent} size={20} /> : null}
              </Pressable>
            );
          })}
        </View>

        {caption(t('settings.section.sound'))}
        <View style={styles.list}>
          <SwitchRow
            title={t('settings.sound')}
            description={t('settings.sound.desc')}
            value={sound}
            onChange={(on) => settingsStore.getState().setSound(on)}
            testID="settings-sound"
          />
          <SwitchRow
            title={t('settings.motion')}
            description={t('settings.motion.desc')}
            // The phone setting wins: shown on and locked, with the reason (AC 12).
            value={osReduceMotion || appReduceMotion}
            disabled={osReduceMotion}
            note={osReduceMotion ? t('settings.motion.osOn') : undefined}
            onChange={(on) => settingsStore.getState().setReduceMotion(on)}
            testID="settings-motion"
            style={styles.rowDivider}
          />
        </View>

        {caption(t('settings.section.games'))}
        <View style={styles.list}>
          <SwitchRow
            title={t('game9.picker.atariHints')}
            description={t('game9.picker.atariHintsDesc')}
            value={!atariHintsOff}
            onChange={(on) => progressStore.getState().setFlag('atariHintsOff', !on)}
            testID="settings-atari"
          />
        </View>

        {caption(t('settings.section.help'))}
        <View style={styles.list}>
          <Pressable
            onPress={() => router.push('/onboarding?replay=1')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.intro')}
            testID="settings-intro"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.rowLabel} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('settings.intro')}
            </Text>
            <ChevronIcon direction="right" color={color.textSecondary} size={20} />
          </Pressable>
        </View>

        {caption(t('settings.section.progress'))}
        <View style={styles.list}>
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.reset')}
            testID="settings-reset"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={[styles.rowLabel, styles.danger]} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('settings.reset')}
            </Text>
          </Pressable>
        </View>
        {erasedAt === 0 ? null : (
          <Text
            style={styles.done}
            accessibilityLiveRegion="polite"
            maxFontSizeMultiplier={TEXT_SCALE}
            testID="settings-reset-done"
          >
            {t('settings.reset.done')}
          </Text>
        )}

        {caption(t('settings.section.legal'))}
        <View style={styles.list}>
          <Pressable
            onPress={() => Linking.openURL(`${LEGAL_URL}#${i18n.language}`)}
            accessibilityRole="link"
            accessibilityLabel={t('settings.legal')}
            accessibilityHint={t('settings.legal.hint')}
            testID="settings-legal"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.rowLabel} maxFontSizeMultiplier={TEXT_SCALE}>
              {t('settings.legal')}
            </Text>
            <ChevronIcon direction="right" color={color.textSecondary} size={20} />
          </Pressable>
        </View>

        {__DEV__ ? (
          <View style={[styles.list, styles.devList]}>
            <Pressable
              onPress={() => router.push('/dev/board')}
              accessibilityRole="button"
              accessibilityLabel={t('dev.board.open')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.rowLabel} maxFontSizeMultiplier={TEXT_SCALE}>
                {t('dev.board.open')}
              </Text>
              <ChevronIcon direction="right" color={color.textSecondary} size={20} />
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.caption} maxFontSizeMultiplier={TEXT_SCALE}>
          {t('settings.version')} {appConfig.expo.version}
        </Text>
      </ScrollView>
      <Sheet
        visible={sheetOpen}
        title={t('settings.reset.title')}
        lines={[t('settings.reset.body')]}
        // Safe default first (AC 20): Keep is the first, primary button.
        actions={[
          {
            label: t('settings.reset.keep'),
            onPress: () => setSheetOpen(false),
            testID: 'settings-reset-keep',
          },
          {
            label: t('settings.reset.confirm'),
            onPress: erase,
            variant: 'danger',
            testID: 'settings-reset-confirm',
          },
        ]}
        onDismiss={() => setSheetOpen(false)}
        testID="settings-reset-sheet"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  sectionCaption: {
    ...typography.caption,
    color: color.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  list: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  devList: { marginTop: spacing.lg },
  rowDivider: { borderTopWidth: 1, borderTopColor: color.border },
  rowLabel: { ...typography.body, color: color.textPrimary, flexShrink: 1 },
  danger: { color: color.error },
  done: { ...typography.body, color: color.success, marginTop: spacing.sm },
  pressed: { backgroundColor: color.background },
  caption: { ...typography.caption, color: color.textSecondary, marginTop: 10 },
});
