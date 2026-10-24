// play-bot (M4 item 2, spec docs/specs/M4-bot-capture-go.md §5): a Capture Go game against the
// bot. The rules live in ../botGame.ts (pure reducer); this screen draws the state, holds the
// "thinking" timer and the end beat, and reports one Outcome per game.
import { useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoBoard, type CaptureEvent, type Highlight } from '@/board';
import { useReduceMotion } from '@/board/useReduceMotion';
import { toVertex, type Color } from '@/engine';
import type { Lesson, Outcome, PlayBotExercise } from '@/lessons';
import { Button } from '@/theme/Button';
import { color, radius, spacing, stone, textScale, typography } from '@/theme/tokens';

import type { FeedbackLine } from '../attempts';
import {
  BOT_DELAY_MS,
  BOT_DELAY_REDUCED_MS,
  END_BEAT_MS,
  botGameReducer,
  canSkip,
  lossReason,
  outcomeOfGame,
  startBotGame,
  type BotGame,
} from '../botGame';
import { checkExerciseMove } from '../engineAdapter';
import { FeedbackCard, type FeedbackText, type FeedbackTone } from '../ExerciseFrame';
import { ExerciseTopBar } from '../ExerciseTopBar';
import { GAME_GOAL_HEIGHT, gameBoardWidth } from '../layout';

type Props = {
  exercise: PlayBotExercise;
  lesson: Lesson;
  index: number;
  onClose: () => void;
  onDone: (outcome: Outcome) => void;
};

type T = ReturnType<typeof useTranslation>['t'];

/** The lesson seed (tests, replays) or a fresh random seed for every game (§6.1). */
function seedFor(exercise: PlayBotExercise, attempt: number): number {
  const fixed = exercise.bot.seed;
  return fixed !== undefined ? fixed + attempt : Math.floor(Math.random() * 0x7fffffff);
}

function isOver(g: BotGame): boolean {
  return g.status === 'won' || g.status === 'lost' || g.status === 'draw';
}

/** Tone of a reading-help or illegal-move note (the dot colour in the feedback card). */
function toneOf(line: FeedbackLine): FeedbackTone {
  if (line.key.startsWith('game.fb.illegal.')) return 'error';
  if (line.key === 'game.fb.captured') return 'success';
  return 'hint';
}

/** The hint's engine sentence (§5.5); none for pressure / random moves. */
function hintSentence(g: BotGame, t: T): string | null {
  const hint = g.hint;
  if (!hint) return null;
  switch (hint.reason) {
    case 'capture':
      return t('game.hint.capture', { at: hint.at });
    case 'save':
      return t('game.hint.save', { at: hint.at });
    case 'atari':
      return t('game.hint.atari', { at: hint.at });
    default:
      return null;
  }
}

function feedbackFor(g: BotGame, exercise: PlayBotExercise, t: T): FeedbackText[] {
  if (g.hintOpen) {
    const lines: FeedbackText[] = [];
    if (exercise.hintKey) lines.push({ text: t(exercise.hintKey), tone: 'hint' });
    const fact = hintSentence(g, t);
    if (fact) lines.push({ text: fact, tone: 'hint' });
    return lines;
  }
  if (g.note) return [{ text: t(g.note.key, g.note.params), tone: toneOf(g.note) }];
  // The goal is on the goal card above the board (M5-life-death AC 42), never repeated here.
  return [];
}

export function PlayBotRunner({ exercise, lesson, index, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [g, dispatch] = useReducer(botGameReducer, undefined, () =>
    startBotGame(exercise, seedFor(exercise, 0)),
  );
  const total = lesson.exercises.length;
  const isLast = index === total - 1;
  const size = exercise.size;
  const over = isOver(g);

  // The bot's reply was computed when the learner moved; it appears after a short pause (AC 44,
  // 45). The timer belongs to the screen and is cleared on unmount or a new game.
  const delay = reduceMotion ? BOT_DELAY_REDUCED_MS : BOT_DELAY_MS;
  const ply = g.game.moves.length;
  useEffect(() => {
    if (g.status !== 'bot-thinking') return;
    const timer = setTimeout(() => dispatch({ type: 'bot' }), delay);
    return () => clearTimeout(timer);
  }, [g.status, ply, g.attempt, delay]);

  // The win / lose card waits for the capture fade (AC 46, 47); without a capture it shows at once.
  const [beatDoneFor, setBeatDoneFor] = useState<number | null>(null);
  const endedWithCapture = over && (g.last?.captured.length ?? 0) > 0;
  useEffect(() => {
    if (!endedWithCapture) return;
    const attempt = g.attempt;
    const timer = setTimeout(() => setBeatDoneFor(attempt), END_BEAT_MS);
    return () => clearTimeout(timer);
  }, [endedWithCapture, g.attempt]);
  const cardVisible = over && (!endedWithCapture || beatDoneFor === g.attempt);

  // Screen reader: every stone once, the learner's and the bot's with its captures (AC 66;
  // M6-settings AC 38: the board is silent here).
  const announced = useRef<string | null>(null);
  useEffect(() => {
    const last = g.last;
    if (!last || last.point === null) return;
    const id = `${g.attempt}-${last.id}`;
    if (announced.current === id) return;
    announced.current = id;
    if (last.color !== g.bot) {
      AccessibilityInfo.announceForAccessibility(
        t(`board.a11y.played.${last.color}`, { vertex: toVertex(last.point, size).toUpperCase() }),
      );
      return;
    }
    const parts = [t('game.a11y.botMoved', { at: toVertex(last.point, size) })];
    if (last.captured.length > 0) parts.push(t('game.a11y.captured', { n: last.captured.length }));
    AccessibilityInfo.announceForAccessibility(parts.join('. '));
  }, [g.last, g.bot, g.attempt, size, t]);

  const lastCapture: CaptureEvent | null =
    g.last && g.last.captured.length > 0
      ? {
          id: g.attempt * 10000 + g.last.id,
          color: g.last.color === 'B' ? 'W' : 'B',
          points: g.last.captured,
        }
      : null;

  const highlights: Highlight[] = [];
  if (g.hintOpen && g.hint && g.status === 'your-turn') {
    highlights.push({ kind: 'hint', points: [g.hint.point] });
  }
  if (g.status === 'won' && g.last?.point)
    highlights.push({ kind: 'success', points: [g.last.point] });
  if (g.status === 'lost' && g.last && g.last.captured.length > 0) {
    highlights.push({ kind: 'error', points: g.last.captured });
  }

  const newGame = (type: 'retry' | 'restart') =>
    dispatch({ type, seed: seedFor(exercise, g.attempt + 1) });

  const boardWidth = gameBoardWidth({
    width: window.width,
    height: window.height - insets.top - insets.bottom,
  });
  const feedback = feedbackFor(g, exercise, t);

  return (
    <>
      <ExerciseTopBar
        index={index}
        total={total}
        onClose={onClose}
        hint={{
          available: exercise.hintKey !== undefined,
          enabled: exercise.hintKey !== undefined && g.status === 'your-turn' && !g.hintOpen,
          open: g.hintOpen,
          onPress: () => dispatch({ type: 'hint' }),
        }}
      />
      <View style={styles.body}>
        {/* The goal card stays on top for the whole game (M5-life-death §5.6, AC 42); the end
            card replaces it once the game is over, so the board never changes size. */}
        {cardVisible ? null : (
          <View style={styles.goal} testID="game-goal">
            <Text maxFontSizeMultiplier={textScale.hud} style={styles.goalText} numberOfLines={2}>
              {t(exercise.promptKey)}
            </Text>
          </View>
        )}
        <View style={styles.score}>
          <ScoreHalf
            name={t('game.you')}
            side={g.learner}
            captured={g.game.captures[g.learner]}
            n={g.n}
            active={g.status === 'your-turn'}
            label={t('game.a11y.score', { n: g.game.captures[g.learner], total: g.n })}
            testID="game-score-you"
          />
          <ScoreHalf
            name={t('game.bot')}
            side={g.bot}
            captured={g.game.captures[g.bot]}
            n={g.n}
            active={g.status === 'bot-thinking'}
            label={t('game.a11y.scoreBot', { n: g.game.captures[g.bot], total: g.n })}
            testID="game-score-bot"
          />
        </View>
        <View style={styles.pillSlot}>
          {over ? null : (
            <TurnPill
              thinking={g.status === 'bot-thinking'}
              side={g.status === 'bot-thinking' ? g.bot : g.learner}
              reduceMotion={reduceMotion}
            />
          )}
        </View>
        <View style={styles.boardWrap}>
          <GoBoard
            size={size}
            stones={g.game.board.cells}
            width={boardWidth}
            showCoordinates={lesson.coordinates ?? false}
            interactive
            disabled={g.status !== 'your-turn'}
            playerColor={g.learner}
            checkPoint={(p) => checkExerciseMove(g.game, p)}
            onPlay={(point) => dispatch({ type: 'play', point })}
            onIllegal={(point) => dispatch({ type: 'play', point })}
            lastMove={g.last?.point ?? null}
            lastCapture={lastCapture}
            highlights={highlights}
            announce={false}
            testID="practice-board"
          />
        </View>
        {cardVisible ? (
          <EndCard
            g={g}
            exercise={exercise}
            isLast={isLast}
            onNext={() => onDone(outcomeOfGame(g) ?? 'solved')}
            onRetry={() => newGame('retry')}
            onSkip={() => {
              dispatch({ type: 'skip' });
              onDone('revealed');
            }}
          />
        ) : (
          <>
            <FeedbackCard lines={over ? [] : feedback} />
            <View style={styles.spacer} />
            {over ? null : (
              <Button
                maxFontSizeMultiplier={textScale.hud}
                label={t('game.restart')}
                variant="text"
                onPress={() => newGame('restart')}
                testID="game-restart"
                style={styles.restart}
              />
            )}
          </>
        )}
      </View>
    </>
  );
}

function StoneDot({ side, size }: { side: Color; size: number }) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        side === 'B' ? styles.black : styles.white,
      ]}
    />
  );
}

function ScoreHalf({
  name,
  side,
  captured,
  n,
  active,
  label,
  testID,
}: {
  name: string;
  side: Color;
  captured: number;
  n: number;
  active: boolean;
  label: string;
  testID: string;
}) {
  const { t } = useTranslation();
  // A slot is filled by a captured stone, which has the opponent's colour. The count itself is
  // only in the a11y label: a "0 / 2" text does not fit next to 2–3 slots at 360 px (mockup).
  const capturedColor: Color = side === 'B' ? 'W' : 'B';
  return (
    <View
      style={[styles.half, active && styles.halfActive]}
      accessible
      accessibilityLabel={label}
      testID={testID}
    >
      <StoneDot side={side} size={24} />
      <View style={styles.halfText}>
        <Text maxFontSizeMultiplier={textScale.hud} style={styles.halfName} numberOfLines={1}>
          {name}
        </Text>
        <Text maxFontSizeMultiplier={textScale.hud} style={styles.halfColor} numberOfLines={1}>
          {side === 'B' ? t('game.black') : t('game.white')}
        </Text>
      </View>
      <View style={styles.slots}>
        {Array.from({ length: n }, (_, i) => (
          <View
            key={i}
            testID={i < captured ? `${testID}-slot-filled` : `${testID}-slot-empty`}
            style={[
              styles.slot,
              i < captured && (capturedColor === 'B' ? styles.black : styles.white),
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function TurnPill({
  thinking,
  side,
  reduceMotion,
}: {
  thinking: boolean;
  side: Color;
  reduceMotion: boolean;
}) {
  const { t } = useTranslation();
  const text = thinking ? t('game.turn.bot') : t('game.turn.you');
  return (
    <View
      style={[styles.pill, thinking && styles.pillWaiting]}
      accessible
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
      testID={thinking ? 'game-turn-bot' : 'game-turn-you'}
    >
      <StoneDot side={side} size={14} />
      <Text
        maxFontSizeMultiplier={textScale.hud}
        style={[styles.pillText, thinking && styles.pillTextWaiting]}
      >
        {text}
      </Text>
      {thinking ? <ThinkingDots animate={!reduceMotion} /> : null}
    </View>
  );
}

/** Three soft dots; they blink unless Reduce Motion is on (AC 67). */
function ThinkingDots({ animate }: { animate: boolean }) {
  const [phase] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.timing(phase, { toValue: 1, duration: 1200, useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, phase]);
  return (
    <View style={styles.dots} testID="game-thinking-dots">
      {[0, 1, 2].map((i) => {
        const start = i * 0.2;
        const opacity = animate
          ? phase.interpolate({
              inputRange: [0, start, start + 0.3, 1],
              outputRange: [0.25, 0.25, 1, 0.25],
              extrapolate: 'clamp',
            })
          : 0.6;
        return <Animated.View key={i} style={[styles.dot, { opacity }]} />;
      })}
    </View>
  );
}

function EndCard({
  g,
  exercise,
  isLast,
  onNext,
  onRetry,
  onSkip,
}: {
  g: BotGame;
  exercise: PlayBotExercise;
  isLast: boolean;
  onNext: () => void;
  onRetry: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const won = g.status === 'won';
  const lost = g.status === 'lost';
  const reason = lossReason(g);
  const title = won ? t('game.win.title') : lost ? t('game.lose.title') : t('game.draw.title');
  const body = won
    ? t('game.win.body', { n: g.n })
    : lost
      ? t('game.lose.body', { n: g.n })
      : t('game.draw.body', { n: g.n });
  const detail = won
    ? exercise.explainKey
      ? t(exercise.explainKey)
      : null
    : reason
      ? t('game.lose.reason', { at: reason.at, lib: reason.lib })
      : null;

  // The card is announced once it appears (AC 66).
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility([title, body, detail].filter(Boolean).join(' '));
  }, [title, body, detail]);

  return (
    <>
      <View style={styles.endCard} testID={won ? 'game-win' : lost ? 'game-lose' : 'game-draw'}>
        <View
          style={[
            styles.endDot,
            { backgroundColor: won ? color.success : lost ? color.error : stone.whiteEdge },
          ]}
        />
        <View style={styles.endText}>
          <Text
            maxFontSizeMultiplier={textScale.hud}
            style={styles.endTitle}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text maxFontSizeMultiplier={textScale.hud} style={styles.endBody}>
            {body}
          </Text>
          {detail ? (
            <Text maxFontSizeMultiplier={textScale.hud} style={styles.endDetail}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.spacer} />
      {won ? (
        <Button
          maxFontSizeMultiplier={textScale.hud}
          label={isLast ? t('game.finish') : t('game.next')}
          onPress={onNext}
          testID={isLast ? 'game-finish' : 'game-next'}
        />
      ) : (
        // One block without the body gap: with *Skip* the lose card must still fit 740 px (AC 68).
        <View>
          <Button
            maxFontSizeMultiplier={textScale.hud}
            label={t('game.retry')}
            onPress={onRetry}
            testID="game-retry"
          />
          {canSkip(g) ? (
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={t('game.skip')}
              variant="text"
              onPress={onSkip}
              testID="game-skip"
              style={styles.restart}
            />
          ) : null}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.sm },
  goal: {
    minHeight: GAME_GOAL_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  goalText: { fontSize: 15, lineHeight: 20, color: color.textPrimary },
  score: { flexDirection: 'row', gap: spacing.sm },
  half: {
    flex: 1,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  halfActive: { borderWidth: 2, borderColor: color.accent, paddingHorizontal: 9 },
  halfText: { flex: 1, minWidth: 0 },
  halfName: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: color.textPrimary },
  halfColor: { fontSize: 12, lineHeight: 15, color: color.textSecondary },
  slots: { flexDirection: 'row', gap: spacing.xs },
  slot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: color.border,
  },
  black: { backgroundColor: stone.black, borderColor: stone.black },
  white: { backgroundColor: stone.white, borderWidth: 1, borderColor: stone.whiteEdge },
  pillSlot: { height: 36, alignItems: 'center' },
  pill: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  pillWaiting: { backgroundColor: 'rgba(255, 253, 248, 0.7)' },
  pillText: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: color.textPrimary },
  pillTextWaiting: { color: color.textSecondary },
  dots: { flexDirection: 'row', gap: 3, marginLeft: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.textSecondary },
  boardWrap: { alignItems: 'center' },
  spacer: { flex: 1 },
  restart: { minHeight: 44 },
  endCard: {
    minHeight: 124,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  endDot: { width: 8, height: 8, borderRadius: 4, marginTop: 10 },
  endText: { flex: 1 },
  endTitle: { ...typography.title, fontSize: 20, lineHeight: 26, color: color.textPrimary },
  endBody: { fontSize: 14, lineHeight: 20, color: color.textPrimary, marginTop: spacing.xs },
  endDetail: { ...typography.caption, color: color.textSecondary, marginTop: spacing.xs },
});
