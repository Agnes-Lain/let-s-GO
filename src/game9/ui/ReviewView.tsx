// The post-game review 复盘 fùpán (spec docs/specs/M6-game-coaching.md §4.4, §5.3): a read-only
// replay with Prev / Next and 1–3 key moments. The moments come from the pure src/coach module;
// this file only holds the timer that evaluates REVIEW_CHUNK positions per tick (AC 27).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoBoard, type Marker } from '@/board';
import {
  REVIEW_CHUNK,
  evaluatePosition,
  planReview,
  reviewMoments,
  type ReviewMoment,
  type ReviewPlan,
} from '@/coach';
import { toVertex } from '@/engine';
import { FeedbackCard, type FeedbackText } from '@/exercises/ExerciseFrame';
import { boardWidthFor } from '@/exercises/layout';
import { Button, IconButton } from '@/theme/Button';
import { CloseIcon } from '@/theme/icons';
import { color, radius, spacing, tapTarget, textScale, typography } from '@/theme/tokens';

import { formatParams } from '../format';
import { handicapStones } from '../handicap';
import type { GameSession, Note } from '../session';

/**
 * Fixed heights at 360×740 (§5.3): top bar 52, chips 44, step line 20, fact card 96, Prev / Next
 * 48, bottom padding 16 and six 8 px gaps.
 */
export const REVIEW_FIXED_HEIGHT = 52 + 44 + 20 + 96 + 48 + 16 + 6 * 8;

/**
 * The moments, computed REVIEW_CHUNK positions per tick (`setTimeout 0`) so the screen never
 * freezes; `skip` (or a playout error) keeps the capture moments only (§5.3).
 */
function useMoments(plan: ReviewPlan): { moments: ReviewMoment[] | null; skip: () => void } {
  const [moments, setMoments] = useState<ReviewMoment[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const chances: number[] = [];
    let index = 0;
    const tick = () => {
      timer.current = null;
      try {
        for (let k = 0; k < REVIEW_CHUNK && index < plan.positions.length; k++, index++) {
          chances.push(evaluatePosition(plan, index));
        }
      } catch {
        setMoments(reviewMoments(plan, null));
        return;
      }
      if (index < plan.positions.length) timer.current = setTimeout(tick, 0);
      else setMoments(reviewMoments(plan, chances));
    };
    timer.current = setTimeout(tick, 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [plan]);

  const skip = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setMoments(reviewMoments(plan, null));
  };
  return { moments, skip };
}

export function ReviewView({ s, onClose }: { s: GameSession; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const say = (note: Note, extra?: Record<string, string>) =>
    t(note.key, { ...formatParams(note, language), ...extra });

  const plan = useMemo(
    () =>
      planReview(
        s.game.moves,
        s.game.komi,
        s.seed,
        s.learner,
        s.size,
        handicapStones(s.size, s.handicap),
      ),
    [s.game.moves, s.game.komi, s.seed, s.learner, s.size, s.handicap],
  );
  const { moments, skip } = useMoments(plan);
  const total = plan.moves.length;
  const [step, setStep] = useState(total);
  const [chosen, setChosen] = useState<number | null>(null);

  // Screen reader: "Move n of N, Black at e4" on every step (AC 35).
  const announced = useRef(step);
  useEffect(() => {
    if (announced.current === step) return;
    announced.current = step;
    const move = plan.moves[step - 1];
    const text = move
      ? t(`coach.review.a11y.${move.type === 'play' ? 'played' : 'passed'}.${move.color}`, {
          n: step,
          total,
          point: move.type === 'play' ? toVertex(move.point, s.size).toUpperCase() : '',
        })
      : t('coach.review.start');
    AccessibilityInfo.announceForAccessibility(text);
  }, [step, plan, total, t, s.size]);

  const boardWidth = Math.max(
    0,
    Math.min(
      boardWidthFor(window.width),
      window.height - insets.top - insets.bottom - REVIEW_FIXED_HEIGHT,
    ),
  );

  const lastMove = step > 0 ? plan.moves[step - 1] : null;
  const moment = moments?.find((m) => m.ply === step) ?? null;
  const markers: Marker[] = moment
    ? [{ kind: 'diamond', point: moment.point, tone: 'moment' }]
    : [];

  const lines: FeedbackText[] = [];
  if (moment) {
    const reply = moment.reply ? say(moment.reply) : undefined;
    lines.push({ text: say(moment.note, reply ? { reply } : undefined), tone: 'hint' });
    if (moment.kind === 'swing') lines.push({ text: t('coach.review.swingDrop'), tone: 'hint' });
  } else if (chosen !== null && moments && moments[chosen]?.ply === step + 1) {
    lines.push({ text: t('coach.review.think'), tone: 'hint' });
  } else if (step === total && moments && moments.length > 0) {
    // The calm closing line (§6); a quiet game already says so above the board.
    lines.push({ text: t('coach.review.closing', { count: moments.length }), tone: 'hint' });
  }

  return (
    <View style={styles.root} testID="review">
      <View style={styles.topBar}>
        <IconButton label={t('lesson.close')} onPress={onClose} testID="review-close">
          <CloseIcon color={color.accent} size={22} />
        </IconButton>
        <View style={styles.titleBox}>
          <Text
            maxFontSizeMultiplier={textScale.hud}
            style={styles.title}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {t('coach.review.button')}
          </Text>
          {s.result?.kind === 'resigned' ? (
            <Text
              maxFontSizeMultiplier={textScale.hud}
              style={styles.caption}
              testID="review-resigned"
            >
              {t('coach.review.resigned')}
            </Text>
          ) : null}
        </View>
        <Text
          maxFontSizeMultiplier={textScale.hud}
          style={styles.caption}
          numberOfLines={1}
          testID="review-hints"
        >
          {t('coach.review.hintsUsed', { n: s.coach.hintsUsed })}
        </Text>
      </View>

      <View style={styles.chips}>
        {moments === null ? (
          <>
            <Text
              maxFontSizeMultiplier={textScale.hud}
              style={styles.preparing}
              testID="review-preparing"
            >
              {t('coach.review.preparing')}
            </Text>
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={t('coach.review.skip')}
              variant="text"
              onPress={skip}
              testID="review-skip"
            />
          </>
        ) : moments.length === 0 ? (
          <Text
            maxFontSizeMultiplier={textScale.hud}
            style={styles.preparing}
            testID="review-quiet"
          >
            {t('coach.review.quiet')}
          </Text>
        ) : (
          <ScrollView horizontal contentContainerStyle={styles.chipRow}>
            {moments.map((m, i) => (
              <Pressable
                key={`${m.kind}-${m.ply}`}
                testID={`review-chip-${i + 1}`}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen === i }}
                onPress={() => {
                  setChosen(i);
                  setStep(m.ply - 1);
                }}
                style={[styles.chip, chosen === i && styles.chipOn]}
              >
                <Text
                  maxFontSizeMultiplier={textScale.hud}
                  style={[styles.chipText, chosen === i && styles.chipTextOn]}
                >
                  {t(`coach.review.chip.${m.kind}`, { i: i + 1 })}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.boardWrap}>
        <GoBoard
          size={s.size}
          stones={plan.states[step].board.cells}
          width={boardWidth}
          showCoordinates
          lastMove={lastMove?.type === 'play' ? lastMove.point : null}
          markers={markers}
          sound={false}
          // The step line below announces "Move n of N"; the board stays quiet (AC 38).
          announce={false}
          testID="review-board"
        />
      </View>

      <Text maxFontSizeMultiplier={textScale.hud} style={styles.step} testID="review-step">
        {step === 0 ? t('coach.review.start') : t('coach.review.step', { n: step, total })}
      </Text>
      <FeedbackCard lines={lines} height={96} />
      <View style={styles.spacer} />
      <View style={styles.row}>
        <Button
          maxFontSizeMultiplier={textScale.hud}
          label={t('coach.review.prev')}
          variant="secondary"
          onPress={() => setStep((k) => Math.max(0, k - 1))}
          disabled={step === 0}
          testID="review-prev"
          style={styles.flex}
        />
        <Button
          maxFontSizeMultiplier={textScale.hud}
          label={t('coach.review.next')}
          variant="secondary"
          onPress={() => setStep((k) => Math.min(total, k + 1))}
          disabled={step === total}
          testID="review-next"
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.sm },
  topBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleBox: { flex: 1 },
  title: { ...typography.label, color: color.textPrimary },
  caption: { ...typography.caption, color: color.textSecondary },
  chips: { height: tapTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chipRow: { gap: spacing.sm, alignItems: 'center' },
  chip: {
    minHeight: tapTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chipOn: { backgroundColor: color.accent, borderColor: color.accent },
  chipText: { ...typography.label, fontSize: 14, color: color.textPrimary },
  chipTextOn: { color: color.onAccent },
  preparing: { flex: 1, ...typography.caption, color: color.textSecondary },
  boardWrap: { alignItems: 'center' },
  step: { height: 20, ...typography.caption, color: color.textSecondary, textAlign: 'center' },
  spacer: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1, paddingHorizontal: spacing.xs },
});
