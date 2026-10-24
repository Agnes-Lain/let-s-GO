// The Learn cards "Play 9×9 · 九路对弈" (spec docs/specs/M6-bot-levels.md AC 14, §7 "Beaten") and
// "Play 13×13" (M6b §13, PO 2026-10-25). 9×9 is open from the start (M6-settings AC 61); 13×13 is
// locked (lock icon + note, not tappable) until any 9×9 win. Both sit below the three modules.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProgress } from '@/store';
import { ChevronIcon, LockIcon } from '@/theme/icons';
import { color, radius, spacing, typography } from '@/theme/tokens';

import { BOT_LEVELS, type GameSize } from '../config';
import { isBeaten, isSize13Unlocked } from '../picker';

export function Game9Card({ onOpen, size = 9 }: { onOpen: () => void; size?: GameSize }) {
  const { t } = useTranslation();
  const bots9 = useProgress((p) => p.bots);
  const bots13 = useProgress((p) => p.bots13);
  const bots = size === 13 ? bots13 : bots9;
  const locked = size === 13 && !isSize13Unlocked(bots9);
  const beaten = BOT_LEVELS.filter((level) => isBeaten(bots, level));
  const title = size === 13 ? t('game.entry.card13') : t('game9.entry.title');
  const id = size === 13 ? 'home-game13' : 'home-game9';
  const line = locked
    ? t('game.size.locked')
    : beaten.length > 0
      ? t('game9.entry.beaten', {
          levels: beaten.map((level) => `${t(`game9.level.${level}.short`)} ✓`).join(' '),
        })
      : null;

  return (
    <Pressable
      onPress={onOpen}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={[title, line].filter(Boolean).join(', ')}
      accessibilityState={locked ? { disabled: true } : undefined}
      testID={id}
      style={({ pressed }) => [styles.card, locked && styles.locked, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={2}>
          {title}
        </Text>
        {line ? (
          <Text
            style={styles.line}
            numberOfLines={2}
            testID={`${id}-line`}
            maxFontSizeMultiplier={2}
          >
            {line}
          </Text>
        ) : null}
      </View>
      {locked ? (
        <View testID={`${id}-lock`}>
          <LockIcon color={color.textSecondary} size={18} />
        </View>
      ) : (
        <ChevronIcon color={color.accent} size={18} />
      )}
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
  locked: { backgroundColor: color.background },
  text: { flex: 1 },
  title: { ...typography.label, color: color.textPrimary },
  line: { ...typography.caption, color: color.textSecondary, marginTop: 2 },
});
