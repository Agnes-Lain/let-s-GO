// Result screen (spec §6.6): stars appear one by one with a soft tock; calm copy, no red.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { playStoneSound } from '@/board/sound';
import { useReduceMotion } from '@/board/useReduceMotion';
import { countOutcomes, type Outcome } from '@/lessons';
import type { RecordResult } from '@/store';
import { Button } from '@/theme/Button';
import { ChevronIcon, StarIcon } from '@/theme/icons';
import { color, radius, spacing, typography } from '@/theme/tokens';

/** Delay between two stars (ms). */
export const STAR_INTERVAL = 250;

type Props = {
  outcomes: readonly Outcome[];
  result: RecordResult;
  /** Primary action when the run earned a star: the next node, or null → *Back to map*. */
  hasNext: boolean;
  onNext: () => void;
  onAgain: () => void;
  onReview: () => void;
  onMap: () => void;
};

export function ResultView({ outcomes, result, hasNext, onNext, onAgain, onReview, onMap }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const { stars } = result;
  const { clean, solved, total } = countOutcomes(outcomes);

  // Stars appear 250 ms apart with a tock each; at once and silent with Reduce Motion.
  const [timed, setTimed] = useState(0);
  const shownStars = reduceMotion ? stars : timed;
  useEffect(() => {
    if (reduceMotion || stars === 0) return;
    const timers = Array.from({ length: stars }, (_, i) =>
      setTimeout(
        () => {
          setTimed(i + 1);
          void playStoneSound();
        },
        STAR_INTERVAL * (i + 1),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion, stars]);

  const starsLabel = t('complete.stars.a11y', { stars });
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(`${starsLabel}. ${t(`complete.title.${stars}`)}`);
  }, [starsLabel, stars, t]);

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View
          style={styles.stars}
          accessible
          accessibilityRole="image"
          accessibilityLabel={starsLabel}
          testID="result-stars"
        >
          {[0, 1, 2].map((i) => {
            const filled = i < shownStars;
            return (
              <View key={i} testID={filled ? 'result-star-filled' : 'result-star-empty'}>
                <StarIcon size={56} color={filled ? color.hint : color.border} filled={filled} />
              </View>
            );
          })}
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t(`complete.title.${stars}`)}
        </Text>
        <Text style={styles.summary}>
          {stars === 0
            ? t('complete.body.0', { solved, total })
            : t('complete.summary', { clean, total })}
        </Text>
        {result.unlockedUnit !== null ? (
          <View style={styles.badge} testID="result-unlocked">
            <Text style={styles.badgeText}>
              {t('complete.unlocked', { n: result.unlockedUnit })}
            </Text>
          </View>
        ) : null}
        {stars < result.previousStars ? (
          <Text style={styles.best} testID="result-best">
            {t('complete.best', { stars: result.previousStars })}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {stars === 0 ? (
          <>
            <Button label={t('complete.review')} onPress={onReview} testID="result-review" />
            <Button
              variant="secondary"
              label={t('practice.tryAgain')}
              onPress={onAgain}
              testID="result-again"
            />
            <Button variant="text" label={t('complete.map')} onPress={onMap} testID="result-map" />
          </>
        ) : (
          <>
            {hasNext ? (
              <Button
                label={t('complete.next')}
                trailingIcon={<ChevronIcon color={color.onAccent} size={18} />}
                onPress={onNext}
                testID="result-next"
              />
            ) : (
              <Button label={t('complete.map')} onPress={onMap} testID="result-map" />
            )}
            <Button
              variant="secondary"
              label={t('complete.again')}
              onPress={onAgain}
              testID="result-again"
            />
            {hasNext ? (
              <Button
                variant="text"
                label={t('complete.map')}
                onPress={onMap}
                testID="result-map"
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingTop: 72, gap: spacing.md },
  stars: { flexDirection: 'row', gap: spacing.md },
  title: { ...typography.display, color: color.textPrimary, textAlign: 'center' },
  summary: { ...typography.body, color: color.textSecondary, textAlign: 'center' },
  badge: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: color.badge,
  },
  badgeText: { ...typography.label, color: color.onBadge },
  best: { ...typography.caption, color: color.textSecondary },
  actions: { gap: spacing.sm },
});
