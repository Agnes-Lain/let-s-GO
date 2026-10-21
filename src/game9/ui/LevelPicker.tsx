// Level picker (spec docs/specs/M6-bot-levels.md §5.1, AC 15, 34, 36, 37): three rows, a tap
// starts the game at once. Nothing is locked; the pre-selected row has a tea-green border.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BotLevel } from '@/bot';
import { progressStore, useProgress } from '@/store';
import { CheckIcon } from '@/theme/icons';
import { TopBar } from '@/theme/Screen';
import { color, radius, spacing, stone, typography } from '@/theme/tokens';

import { BOT_LEVELS, GAME_KOMI_9 } from '../config';
import { formatNumber } from '../format';
import { isBeaten, preselectedLevel, showEasierTip } from '../picker';

export const LEVEL_ROW_HEIGHT = 72;

export function LevelPicker({ onPick }: { onPick: (level: BotLevel) => void }) {
  const { t, i18n } = useTranslation();
  const bots = useProgress((p) => p.bots);
  const flags = useProgress((p) => p.flags);
  const selected = preselectedLevel(bots);
  // The tip is decided once when the picker opens, then remembered as shown (AC 37: once).
  const [tip] = useState(() => showEasierTip(bots, flags));
  useEffect(() => {
    if (tip) progressStore.getState().setFlag('easierTipShown');
  }, [tip]);

  return (
    <View style={styles.root}>
      <TopBar showBack title={t('game9.entry.title')} />
      <Text style={styles.prompt} accessibilityRole="header">
        {t('game9.picker.title')}
      </Text>
      {tip ? (
        <Text style={styles.tip} testID="game9-tip">
          {t('game9.tip.easier')}
        </Text>
      ) : null}
      {BOT_LEVELS.map((level) => {
        const beaten = isBeaten(bots, level);
        const name = t(`game9.level.${level}`);
        const desc = t(`game9.level.${level}.desc`);
        return (
          <Pressable
            key={level}
            onPress={() => onPick(level)}
            accessibilityRole="button"
            accessibilityLabel={[name, desc, beaten ? t('game9.level.beaten') : '']
              .filter(Boolean)
              .join('. ')}
            accessibilityState={{ selected: level === selected }}
            testID={`game9-level-${level}`}
            style={({ pressed }) => [
              styles.row,
              level === selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.dots}>
              {Array.from({ length: level }, (_, i) => (
                <View key={i} style={styles.dot} />
              ))}
            </View>
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.desc} numberOfLines={1}>
                {desc}
              </Text>
            </View>
            {beaten ? (
              <View style={styles.beaten} testID={`game9-level-${level}-beaten`}>
                <CheckIcon color={color.success} size={18} />
                <Text style={styles.beatenText}>{t('game9.level.beaten')}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      {isBeaten(bots, 3) ? (
        <View style={styles.badge} testID="game9-challenge-beaten">
          <Text style={styles.badgeText}>{t('game9.picker.challengeBeaten')}</Text>
        </View>
      ) : null}
      <Text style={styles.caption}>
        {t('game9.youBlack', { komi: formatNumber(GAME_KOMI_9, i18n.language) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.sm },
  prompt: { ...typography.title, fontSize: 20, color: color.textPrimary, marginBottom: spacing.xs },
  tip: { ...typography.body, color: color.hint },
  row: {
    minHeight: LEVEL_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  selected: { borderWidth: 2, borderColor: color.success, paddingHorizontal: spacing.lg - 1 },
  pressed: { opacity: 0.7 },
  dots: { width: 36, flexDirection: 'row', gap: 3 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: stone.black },
  text: { flex: 1, minWidth: 0 },
  name: { ...typography.label, color: color.textPrimary },
  desc: { ...typography.caption, color: color.textSecondary, marginTop: 2 },
  beaten: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  beatenText: { ...typography.caption, color: color.success },
  badge: {
    alignSelf: 'center',
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: color.badge,
  },
  badgeText: { ...typography.label, fontSize: 14, color: color.onBadge },
  caption: { ...typography.caption, color: color.textSecondary, textAlign: 'center' },
});
