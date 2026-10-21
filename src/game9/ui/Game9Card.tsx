// The Home card "Play 9×9 · 九路对弈" (spec docs/specs/M6-bot-levels.md AC 14, §7 "Beaten"):
// open once Unit 14 has ≥ 1 star, otherwise shown disabled with the locked snackbar.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProgress } from '@/store';
import { ChevronIcon, LockIcon } from '@/theme/icons';
import { color, radius, spacing, typography } from '@/theme/tokens';

import { BOT_LEVELS } from '../config';
import { UNLOCK_LESSON, isBeaten } from '../picker';

export function Game9Card({ onOpen, onLocked }: { onOpen: () => void; onLocked: () => void }) {
  const { t } = useTranslation();
  const open = useProgress((p) => (p.lessons[UNLOCK_LESSON]?.stars ?? 0) > 0);
  const bots = useProgress((p) => p.bots);
  const beaten = BOT_LEVELS.filter((level) => isBeaten(bots, level));
  const title = t('game9.entry.title');
  const line = open
    ? beaten.length > 0
      ? t('game9.entry.beaten', {
          levels: beaten.map((level) => `${t(`game9.level.${level}.short`)} ✓`).join(' '),
        })
      : null
    : t('game9.entry.locked');

  return (
    <Pressable
      onPress={open ? onOpen : onLocked}
      accessibilityRole="button"
      accessibilityLabel={[title, line].filter(Boolean).join(', ')}
      accessibilityState={{ disabled: !open }}
      testID={open ? 'home-game9' : 'home-game9-locked'}
      style={({ pressed }) => [styles.card, !open && styles.locked, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {line ? (
          <Text style={styles.line} numberOfLines={1} testID="home-game9-line">
            {line}
          </Text>
        ) : null}
      </View>
      {open ? (
        <ChevronIcon color={color.accent} size={18} />
      ) : (
        <LockIcon color={color.textSecondary} size={18} />
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
  locked: { opacity: 0.6 },
  pressed: { opacity: 0.7 },
  text: { flex: 1 },
  title: { ...typography.label, color: color.textPrimary },
  line: { ...typography.caption, color: color.textSecondary, marginTop: 2 },
});
