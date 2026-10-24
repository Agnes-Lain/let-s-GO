// The Home card "Play 9×9 · 九路对弈" (spec docs/specs/M6-bot-levels.md AC 14, §7 "Beaten").
// Open from the start (M6-settings AC 61, PO 2026-10-23): someone who knows the rules can play
// right away. It sits below the three modules on Home.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProgress } from '@/store';
import { ChevronIcon } from '@/theme/icons';
import { color, radius, spacing, typography } from '@/theme/tokens';

import { BOT_LEVELS } from '../config';
import { isBeaten } from '../picker';

export function Game9Card({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const bots = useProgress((p) => p.bots);
  const beaten = BOT_LEVELS.filter((level) => isBeaten(bots, level));
  const title = t('game9.entry.title');
  const line =
    beaten.length > 0
      ? t('game9.entry.beaten', {
          levels: beaten.map((level) => `${t(`game9.level.${level}.short`)} ✓`).join(' '),
        })
      : null;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={[title, line].filter(Boolean).join(', ')}
      testID="home-game9"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={2}>
          {title}
        </Text>
        {line ? (
          <Text
            style={styles.line}
            numberOfLines={1}
            testID="home-game9-line"
            maxFontSizeMultiplier={2}
          >
            {line}
          </Text>
        ) : null}
      </View>
      <ChevronIcon color={color.accent} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1 },
  title: { ...typography.label, color: color.textPrimary },
  line: { ...typography.caption, color: color.textSecondary, marginTop: 2 },
});
