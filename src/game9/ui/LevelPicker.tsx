// Level picker (spec docs/specs/M6-bot-levels.md §5.1, AC 15, 34, 36, 37; M6-beginner-friendly
// §5.1, AC 7–8): three level rows (radio), the handicap 让子 chips with a mini board, then Start.
// Nothing is locked; the selected row has a tea-green border.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoBoard } from '@/board';
import type { BotLevel } from '@/bot';
import { parseVertex } from '@/engine';
import { progressStore, useProgress } from '@/store';
import { Button } from '@/theme/Button';
import { CheckIcon } from '@/theme/icons';
import { TopBar } from '@/theme/Screen';
import { SwitchRow } from '@/theme/SwitchRow';
import { color, radius, spacing, stone, textScale, typography } from '@/theme/tokens';

import { BOT_LEVELS } from '../config';
import { HANDICAP_CHOICES, handicapStones, suggestedHandicap, type Handicap } from '../handicap';
import { isBeaten, preselectedLevel, showEasierTip } from '../picker';

export const LEVEL_ROW_HEIGHT = 72;
export const HANDICAP_CHIP_HEIGHT = 48;
const PREVIEW_SIZE = 96;

/** The mini board's stones: the handicap points in Black (AC 8). */
function previewStones(n: Handicap): ('B' | null)[] {
  const cells: ('B' | null)[] = Array(81).fill(null);
  for (const v of handicapStones(n)) {
    const p = parseVertex(v, 9);
    cells[p.y * 9 + p.x] = 'B';
  }
  return cells;
}

export function LevelPicker({ onPick }: { onPick: (level: BotLevel, handicap: Handicap) => void }) {
  const { t } = useTranslation();
  const bots = useProgress((p) => p.bots);
  const flags = useProgress((p) => p.flags);
  // Until the learner taps, the level and handicap follow the stored progress (it may load late).
  const [choice, setChoice] = useState<{ level: BotLevel; handicap: Handicap } | null>(null);
  const selected = choice?.level ?? preselectedLevel(bots);
  const suggested = suggestedHandicap(bots, selected);
  const handicap = choice?.handicap ?? suggested;
  // The tip is decided once when the picker opens, then remembered as shown (AC 37: once).
  const [tip] = useState(() => showEasierTip(bots, flags));
  useEffect(() => {
    if (tip) progressStore.getState().setFlag('easierTipShown');
  }, [tip]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.root}>
      {/* The title carries the term + pinyin (fr/en are long), so it gets its own wrapping line
          under the back button instead of the one-line top-bar slot. */}
      <TopBar showBack />
      <Text
        maxFontSizeMultiplier={textScale.page}
        style={styles.title}
        accessibilityRole="header"
        testID="game9-picker-title"
      >
        {t('game9.entry.title')}
      </Text>
      <Text maxFontSizeMultiplier={textScale.page} style={styles.prompt}>
        {t('game9.picker.title')}
      </Text>
      {tip ? (
        <Text maxFontSizeMultiplier={textScale.page} style={styles.tip} testID="game9-tip">
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
            // A tap only selects; the handicap jumps to that level's suggestion (AC 7, 8).
            onPress={() => setChoice({ level, handicap: suggestedHandicap(bots, level) })}
            accessibilityRole="radio"
            accessibilityLabel={[name, desc, beaten ? t('game9.level.beaten') : '']
              .filter(Boolean)
              .join('. ')}
            accessibilityState={{ selected: level === selected, checked: level === selected }}
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
              <Text maxFontSizeMultiplier={textScale.page} style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text
                maxFontSizeMultiplier={textScale.page}
                style={styles.desc}
                testID={`game9-level-${level}-desc`}
              >
                {desc}
              </Text>
            </View>
            {beaten ? (
              <View style={styles.beaten} testID={`game9-level-${level}-beaten`}>
                <CheckIcon color={color.success} size={18} />
                <Text maxFontSizeMultiplier={textScale.page} style={styles.beatenText}>
                  {t('game9.level.beaten')}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      {isBeaten(bots, 3) ? (
        <View style={styles.badge} testID="game9-challenge-beaten">
          <Text maxFontSizeMultiplier={textScale.page} style={styles.badgeText}>
            {t('game9.picker.challengeBeaten')}
          </Text>
        </View>
      ) : null}
      {/* One header per screen (M6-settings AC 36): the title above. */}
      <Text maxFontSizeMultiplier={textScale.page} style={styles.prompt}>
        {t('game9.picker.handicap')}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {HANDICAP_CHOICES.map((n) => (
          <Pressable
            key={n}
            onPress={() => setChoice({ level: selected, handicap: n })}
            accessibilityRole="radio"
            accessibilityLabel={[
              n === 0 ? t('game9.picker.even') : t('game9.picker.stonesA11y', { n }),
              n === suggested ? t('game9.picker.suggested') : '',
            ]
              .filter(Boolean)
              .join(', ')}
            accessibilityState={{ selected: n === handicap, checked: n === handicap }}
            testID={`game9-handicap-${n}`}
            style={({ pressed }) => [
              styles.chip,
              n === handicap && styles.chipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              maxFontSizeMultiplier={textScale.page}
              style={[styles.chipText, n === handicap && styles.chipTextSelected]}
            >
              {n === 0 ? t('game9.picker.even') : t('game9.picker.stones', { n })}
            </Text>
            {/* The suggestion is named in text, not only by colour (§5.1). */}
            {n === suggested ? (
              <Text
                maxFontSizeMultiplier={textScale.page}
                style={[styles.chipTag, n === handicap && styles.chipTextSelected]}
                numberOfLines={1}
                testID={`game9-handicap-${n}-suggested`}
              >
                {t('game9.picker.suggested')}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      <View style={styles.explainRow}>
        <Text
          maxFontSizeMultiplier={textScale.page}
          style={styles.explain}
          testID="game9-handicap-explain"
        >
          {handicap === 0
            ? t('game9.picker.explainEven')
            : t('game9.picker.explain', { n: handicap })}
        </Text>
        <View
          testID="game9-handicap-preview"
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <GoBoard size={9} stones={previewStones(handicap)} width={PREVIEW_SIZE} sound={false} />
        </View>
      </View>
      {/* The whole row is the switch (M6-settings AC 17, 35); the same flag as Settings (AC 18). */}
      <SwitchRow
        title={t('game9.picker.atariHints')}
        description={t('game9.picker.atariHintsDesc')}
        value={!flags.atariHintsOff}
        onChange={(on) => progressStore.getState().setFlag('atariHintsOff', !on)}
        testID="game9-atari-hints"
        style={styles.hintsRow}
      />
      <Button
        label={t('game9.picker.start')}
        onPress={() => onPick(selected, handicap)}
        testID="game9-start"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  root: { flexGrow: 1, gap: spacing.sm, paddingBottom: spacing.lg },
  title: { ...typography.title, fontSize: 20, color: color.textPrimary },
  prompt: { ...typography.label, color: color.textSecondary, marginBottom: spacing.xs },
  tip: { ...typography.body, color: color.hint },
  row: {
    minHeight: LEVEL_ROW_HEIGHT,
    paddingVertical: spacing.sm,
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
  chips: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    flex: 1,
    minWidth: 44,
    minHeight: HANDICAP_CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  chipSelected: { backgroundColor: color.accent, borderColor: color.accent },
  chipText: { ...typography.label, fontSize: 15, color: color.textPrimary },
  chipTextSelected: { color: color.onAccent },
  // 12 px: no text under 12 px on the picker (M6-settings AC 40).
  chipTag: { fontSize: 12, lineHeight: 14, color: color.textSecondary },
  hintsRow: { paddingHorizontal: 0 },
  explainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  explain: { flex: 1, fontSize: 14, lineHeight: 20, color: color.textPrimary },
});
