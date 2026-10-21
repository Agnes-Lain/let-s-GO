// The count (数子 shùzǐ) table under the board (spec docs/specs/M6-bot-levels.md AC 30, §5.4):
// stones + land (+ komi) = total per side and the neutral points, all from ScoreResult.
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { Highlight } from '@/board';
import type { Color, ScoreResult, Vertex } from '@/engine';
import { color, spacing, stone } from '@/theme/tokens';

import { territoryPoints } from '../countView';

export function countHighlights(
  score: ScoreResult,
  cells: readonly (Color | null)[],
  dead: readonly Vertex[],
): Highlight[] {
  const land = territoryPoints(score, cells, dead);
  return [
    { kind: 'territoryB', points: land.B },
    { kind: 'territoryW', points: land.W },
  ];
}

export function CountTable({ score, n }: { score: ScoreResult; n: (value: number) => string }) {
  const { t } = useTranslation();
  const { black, white } = score;
  return (
    <View style={styles.table} testID="game9-count-table">
      <View style={styles.row} testID="game9-count-black">
        <View style={[styles.dot, styles.black]} />
        <Text style={styles.side}>{t('game9.black')}</Text>
        <Text style={styles.sum}>
          {t('game9.count.row', {
            stones: n(black.stones),
            territory: n(black.territory),
            total: n(black.total),
          })}
        </Text>
      </View>
      <View style={styles.row} testID="game9-count-white">
        <View style={[styles.dot, styles.white]} />
        <Text style={styles.side}>{t('game9.white')}</Text>
        <Text style={styles.sum}>
          {t('game9.count.row.komi', {
            stones: n(white.stones),
            territory: n(white.territory),
            komi: n(white.komi),
            total: n(white.total),
          })}
        </Text>
      </View>
      <Text style={styles.neutral} testID="game9-count-neutral">
        {t('game9.count.neutral', { count: score.dame.length })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  table: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7 },
  black: { backgroundColor: stone.black },
  white: { backgroundColor: stone.white, borderWidth: 1, borderColor: stone.whiteEdge },
  side: { width: 48, fontSize: 14, lineHeight: 20, fontWeight: '600', color: color.textPrimary },
  sum: { flex: 1, fontSize: 14, lineHeight: 20, color: color.textPrimary },
  neutral: { fontSize: 13, lineHeight: 18, color: color.textSecondary },
});
