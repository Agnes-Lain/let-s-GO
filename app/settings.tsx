import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import appConfig from '../app.json';
import { setLanguageChoice, useLanguageChoice, type LanguageChoice } from '@/i18n';
import { CheckIcon, ChevronIcon } from '@/theme/icons';
import { Screen, TopBar } from '@/theme/Screen';
import { color, radius, spacing, typography } from '@/theme/tokens';

const LANGUAGE_OPTIONS: { choice: LanguageChoice; labelKey: string }[] = [
  { choice: 'system', labelKey: 'settings.language.system' },
  { choice: 'zh-CN', labelKey: 'settings.language.zh' },
  { choice: 'en', labelKey: 'settings.language.en' },
  { choice: 'fr', labelKey: 'settings.language.fr' },
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const currentChoice = useLanguageChoice();
  const router = useRouter();

  return (
    <Screen>
      <TopBar showBack title={t('settings.title')} />
      <Text style={styles.sectionCaption} accessibilityRole="header">
        {t('settings.language')}
      </Text>
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
              <Text style={styles.rowLabel}>{label}</Text>
              {selected ? <CheckIcon color={color.accent} size={20} /> : null}
            </Pressable>
          );
        })}
      </View>
      {__DEV__ ? (
        <View style={[styles.list, styles.devList]}>
          <Pressable
            onPress={() => router.push('/dev/board')}
            accessibilityRole="button"
            accessibilityLabel={t('dev.board.open')}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.rowLabel}>{t('dev.board.open')}</Text>
            <ChevronIcon direction="right" color={color.textSecondary} size={20} />
          </Pressable>
        </View>
      ) : null}
      <Text style={styles.caption}>
        {t('settings.version')} {appConfig.expo.version}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: spacing.lg,
  },
  devList: { marginTop: spacing.lg },
  rowDivider: { borderTopWidth: 1, borderTopColor: color.border },
  rowLabel: { ...typography.body, color: color.textPrimary },
  pressed: { backgroundColor: color.background },
  caption: { ...typography.caption, color: color.textSecondary, marginTop: 10 },
});
