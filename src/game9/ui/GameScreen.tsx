// The 9×9 / 13×13 game screen (spec docs/specs/M6-bot-levels.md §5.2–5.4, M6b-13x13-game.md
// §5.2): playing, marking dead stones,
// the count and the result are states of one screen. The rules live in ../session.ts (a pure
// reducer); this file draws the state, holds the bot timer and the sheets, and saves progress.
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoBoard, type CaptureEvent, type Highlight, type Marker } from '@/board';
import { useReduceMotion } from '@/board/useReduceMotion';
import type { BotLevel } from '@/bot';
import { REVIEW_MIN_MOVES } from '@/coach';
import { parseVertex, toVertex, type CheckResult, type Point } from '@/engine';
import { FeedbackCard, type FeedbackText, type FeedbackTone } from '@/exercises/ExerciseFrame';
import { boardWidthFor } from '@/exercises/layout';
import { progressStore, useProgress } from '@/store';
import { Button, IconButton } from '@/theme/Button';
import { CloseIcon } from '@/theme/icons';
import { color, radius, spacing, textScale, typography } from '@/theme/tokens';

import type { GameSize } from '../config';
import { atariLine, dangerOf, type DangerGroup } from '../danger';
import { checkGameMove } from '../engineView';
import { formatNumber, formatParams } from '../format';
import { nextHandicap, suggestedHandicap, type Handicap } from '../handicap';
import {
  BOT_DELAY_MS,
  BOT_DELAY_REDUCED_MS,
  anyAtari,
  canCountNow,
  canResignWhileThinking,
  canTakeBack,
  gameReducer,
  lossFact,
  outcomeOf,
  startSession,
  statusOf,
  winnerNote,
  type GameEvent,
  type GameSession,
  type Note,
} from '../session';
import { countStones } from '../countView';
import { CountTable, countHighlights } from './CountTable';
import { ReviewView } from './ReviewView';
import { Sheet } from '@/theme/Sheet';

/**
 * Fixed heights at 360×740 (§5.2, AC 38): top bar 52, status 48 + 8, gap 8 under the board,
 * feedback / result card 100 + 8, buttons 48 + 8 + 48 (Hint 提示 row + Pass row, M6-game-coaching
 * §5.1), bottom padding 16.
 */
export const GAME9_FIXED_HEIGHT = 52 + 56 + 8 + 108 + 48 + 8 + 48 + 16;
/** The note card holds two note lines (M6-game-coaching §5.1). */
const NOTE_CARD_HEIGHT = 96;
/** "Thinking…" shows only when the bot's turn lasts longer than this (M6b AC 30: no flicker). */
export const THINKING_NOTICE_MS = 500;

type Sheets = 'none' | 'pass' | 'countNow' | 'resign' | 'leave';

const ALWAYS_LEGAL = (): CheckResult => ({ legal: true });

function newSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

function toneOf(note: Note): FeedbackTone {
  if (note.key.startsWith('game.fb.illegal.') || note.key === 'game9.dispute.alive') return 'error';
  if (note.key === 'game.fb.captured' || note.key === 'game9.mark.agreed') return 'success';
  return 'hint';
}

/** Groups in atari while the learner is to move (AC 30, 32): none while the bot thinks or with the hints off. */
function visibleDanger(s: GameSession): DangerGroup[] {
  return s.atariHints && s.phase === 'playing' && !s.thinking ? dangerOf(s.game, s.learner) : [];
}

export function GameScreen({
  level,
  size = 9,
  handicap = 0,
  confirmMoves = false,
  onLeave,
  onChangeLevel,
}: {
  level: BotLevel;
  /** The board: 9×9 (default) or 13×13 (M6b). */
  size?: GameSize;
  /** "Confirm each move" (M6b AC 22): a lift keeps a preview, the Play button commits. */
  confirmMoves?: boolean;
  /** Black stones placed before the game (让子, M6-beginner-friendly §3). */
  handicap?: Handicap;
  /** Back to Home (✕ after the game, Home button, confirmed Leave). */
  onLeave: () => void;
  onChangeLevel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const flags = useProgress((p) => p.flags);

  const [s, setS] = useState<GameSession>(() =>
    startSession(level, newSeed(), handicap, !flags.atariHintsOff, size),
  );
  const current = useRef(s);
  const send = useCallback(
    (event: GameEvent) => {
      const before = current.current;
      const next = gameReducer(before, event);
      if (next === before) return;
      current.current = next;
      setS(next);
      // Saved here, in the event handler, so a re-render never records twice (AC 34).
      // The next handicap suggestion steps with the outcome (M6-beginner-friendly AC 11).
      const outcome = outcomeOf(next);
      if (outcome && !before.result) {
        progressStore
          .getState()
          .recordGame(level, outcome, nextHandicap(next.handicap, outcome), size);
      }
    },
    [level, size],
  );

  const [sheet, setSheet] = useState<Sheets>('none');
  const n = (value: number) => formatNumber(value, language);
  const say = (note: Note) => t(note.key, formatParams(note, language));

  // The bot answers after a short pause; level 3 then thinks synchronously (AC 16, 17, 41).
  const delay = reduceMotion ? BOT_DELAY_REDUCED_MS : BOT_DELAY_MS;
  const ply = s.game.moves.length;
  useEffect(() => {
    if (!s.thinking) return;
    const timer = setTimeout(() => send({ type: 'bot' }), delay);
    return () => clearTimeout(timer);
  }, [s.thinking, ply, delay, send]);

  // 13×13: "Thinking…" once the bot's turn lasts over 0.5 s, never earlier (M6b AC 30). The
  // notice is keyed by the ply so a new bot turn starts without it.
  const [slowPly, setSlowPly] = useState<number | null>(null);
  useEffect(() => {
    if (!s.thinking || size !== 13) return;
    const timer = setTimeout(() => setSlowPly(ply), THINKING_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [s.thinking, ply, size]);
  const showThinking = s.thinking && s.phase === 'playing' && slowPly === ply;

  // "Confirm each move": the chosen point belongs to one position; any change drops it.
  const [pending, setPending] = useState<{ point: Point; game: GameSession['game'] } | null>(null);
  const pendingPoint =
    confirmMoves && pending && pending.game === s.game && s.phase === 'playing' && !s.thinking
      ? pending.point
      : null;
  const onBoardPlay = (point: Point) => {
    if (confirmMoves) setPending({ point, game: s.game });
    else send({ type: 'play', point });
  };
  const onConfirmPlay = () => {
    if (!pendingPoint) return;
    setPending(null);
    send({ type: 'play', point: pendingPoint });
  };

  // Screen reader: every move, pass and capture, and the state changes (AC 40).
  const announcedMove = useRef(0);
  useEffect(() => {
    const last = s.last;
    if (!last || last.id === announcedMove.current) return;
    announcedMove.current = last.id;
    // A take-back's restored move is not news; the feedback card says "Taken back".
    if (last.restored) return;
    const parts = [
      last.point
        ? t(`game9.a11y.played.${last.color}`, { point: toVertex(last.point, size) })
        : t(`game9.a11y.passed.${last.color}`),
    ];
    if (last.captured.length > 0)
      parts.push(t('game9.a11y.captured', { count: last.captured.length }));
    AccessibilityInfo.announceForAccessibility(parts.join(' '));
  }, [s.last, t, size]);
  const announcedPhase = useRef(s.phase);
  useEffect(() => {
    if (announcedPhase.current === s.phase) return;
    announcedPhase.current = s.phase;
    if (s.phase === 'mark') AccessibilityInfo.announceForAccessibility(t('game9.a11y.over'));
    if (s.phase === 'count' || s.phase === 'result') {
      AccessibilityInfo.announceForAccessibility(say(statusOf(s)));
    }
  });

  // ✕ and system back mid-game open the leave sheet; nothing is saved (AC 24). In the review,
  // back closes the review (M6-game-coaching AC 34).
  const [exiting, setExiting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const inGame = s.phase !== 'result' && !exiting;
  usePreventRemove(inGame || (reviewing && !exiting), () => {
    if (reviewing) setReviewing(false);
    else setSheet((open) => (open === 'leave' ? 'none' : 'leave'));
  });
  const leave = () => {
    setSheet('none');
    setExiting(true);
  };
  useEffect(() => {
    if (exiting) onLeave();
  }, [exiting, onLeave]);

  const boardWidth = Math.max(
    0,
    Math.min(
      boardWidthFor(window.width),
      window.height - insets.top - insets.bottom - GAME9_FIXED_HEIGHT,
    ),
  );

  const levelName = t(`game9.level.${level}.short`);
  // In the result state the card below says win / lose; the status line keeps the count line.
  const status: Note =
    s.phase === 'result' && s.result?.kind === 'count'
      ? winnerNote(s.result.winner, s.result.margin)
      : statusOf(s);

  const onPass = () => {
    if (!flags.passExplained) setSheet('pass');
    else send({ type: 'pass' });
  };
  // The very first take-back ever explains itself once (AC 15).
  const onTakeBack = () => {
    send({ type: 'takeback', first: !flags.takebackExplained });
    if (!flags.takebackExplained) progressStore.getState().setFlag('takebackExplained');
  };
  const bots9 = useProgress((p) => p.bots);
  const bots13 = useProgress((p) => p.bots13);
  const bots = size === 13 ? bots13 : bots9;
  const onAgain = () =>
    send({ type: 'new', seed: newSeed(), handicap: suggestedHandicap(bots, level, size) });

  if (reviewing && s.phase === 'result') {
    return <ReviewView s={s} onClose={() => setReviewing(false)} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <IconButton
          label={t('lesson.close')}
          onPress={() => (inGame ? setSheet('leave') : onLeave())}
          testID="game9-close"
        >
          <CloseIcon color={color.accent} size={22} />
        </IconButton>
        <Text
          maxFontSizeMultiplier={textScale.hud}
          style={styles.header}
          // The 13×13 header also names the size (M6b §7): two lines so the komi stays visible.
          numberOfLines={size === 13 ? 2 : 1}
          testID="game9-header"
        >
          {s.phase === 'count'
            ? t('game9.count.title')
            : size === 13
              ? s.handicap > 0
                ? t('game.header.size', {
                    size,
                    level: levelName,
                    n: s.handicap,
                    komi: n(s.game.komi),
                  })
                : t('game.header.sizeEven', { size, level: levelName, komi: n(s.game.komi) })
              : s.handicap > 0
                ? t('game9.header.handicap', {
                    level: levelName,
                    n: s.handicap,
                    komi: n(s.game.komi),
                  })
                : t('game9.header', { level: levelName, komi: n(s.game.komi) })}
        </Text>
        <Text
          maxFontSizeMultiplier={textScale.hud}
          style={styles.move}
          numberOfLines={1}
          testID="game9-move"
        >
          {t('game9.move', { n: s.game.moves.length })}
        </Text>
      </View>

      <View style={styles.status} testID="game9-status">
        <Text
          maxFontSizeMultiplier={textScale.hud}
          style={styles.statusText}
          numberOfLines={2}
          // The count and the result are announced by the screen (AC 37): no second Android read.
          accessibilityLiveRegion={s.phase === 'count' || s.phase === 'result' ? 'none' : 'polite'}
          testID="game9-status-text"
        >
          {/* 13×13: a long bot turn says "Thinking…" in place of the turn line (M6b AC 30). */}
          {showThinking ? t('game.thinking') : say(status)}
        </Text>
        {s.phase === 'mark' ? (
          <MarkCount
            count={s.marks.length}
            onClear={s.marks.length > 0 && !s.dispute ? () => send({ type: 'clearMarks' }) : null}
          />
        ) : null}
      </View>

      <View
        style={styles.boardWrap}
        // The learner's next turn starts on the first touch: the notes clear (AC 12).
        onTouchStart={() => send({ type: 'touch' })}
      >
        <GameBoard
          s={s}
          width={boardWidth}
          send={send}
          onPlay={onBoardPlay}
          pending={pendingPoint}
        />
      </View>

      <Bottom
        s={s}
        say={say}
        n={n}
        send={send}
        onPass={onPass}
        onTakeBack={onTakeBack}
        onAgain={onAgain}
        nextHandicap={suggestedHandicap(bots, level, size)}
        confirmMoves={confirmMoves}
        canConfirm={pendingPoint !== null}
        onConfirmPlay={onConfirmPlay}
        onCountNow={() => setSheet('countNow')}
        onResign={() => setSheet('resign')}
        onChangeLevel={onChangeLevel}
        onHome={onLeave}
        onReview={() => setReviewing(true)}
      />

      <Sheet
        visible={sheet === 'pass'}
        title={t('game9.pass.title')}
        lines={[t('game9.passExplain')]}
        onDismiss={() => setSheet('none')}
        testID="game9-pass-sheet"
        actions={[
          {
            label: t('game9.passExplain.ok'),
            testID: 'game9-pass-ok',
            onPress: () => {
              progressStore.getState().setFlag('passExplained');
              setSheet('none');
              send({ type: 'pass' });
            },
          },
          {
            label: t('game9.keepPlaying'),
            variant: 'secondary',
            testID: 'game9-pass-keep',
            onPress: () => {
              progressStore.getState().setFlag('passExplained');
              setSheet('none');
            },
          },
        ]}
      />
      <Sheet
        visible={sheet === 'countNow'}
        title={t('game9.btn.count')}
        lines={[t('game9.countNow.ask'), ...(anyAtari(s.game) ? [t('game9.countNow.atari')] : [])]}
        onDismiss={() => setSheet('none')}
        testID="game9-count-sheet"
        actions={[
          {
            label: t('game9.btn.count'),
            testID: 'game9-count-confirm',
            onPress: () => {
              setSheet('none');
              send({ type: 'countNow' });
            },
          },
          {
            label: t('game9.keepPlaying'),
            variant: 'secondary',
            testID: 'game9-count-keep',
            onPress: () => setSheet('none'),
          },
        ]}
      />
      <Sheet
        visible={sheet === 'resign'}
        title={t('game9.resign.ask')}
        onDismiss={() => setSheet('none')}
        testID="game9-resign-sheet"
        actions={[
          {
            label: t('game9.btn.resign'),
            testID: 'game9-resign-confirm',
            onPress: () => {
              setSheet('none');
              send({ type: 'resign' });
            },
          },
          {
            label: t('game9.keepPlaying'),
            variant: 'secondary',
            testID: 'game9-resign-keep',
            onPress: () => setSheet('none'),
          },
        ]}
      />
      <Sheet
        visible={s.phase === 'mark' && s.dispute !== null}
        title={s.note ? say(s.note) : ''}
        onDismiss={() => undefined}
        testID="game9-dispute-sheet"
        actions={[
          {
            label: t('game9.dispute.accept'),
            testID: 'game9-dispute-accept',
            onPress: () => send({ type: 'accept' }),
          },
          {
            label: t('game9.dispute.playOn'),
            variant: 'secondary',
            testID: 'game9-dispute-playon',
            onPress: () => send({ type: 'playOn' }),
          },
        ]}
      />
      <Sheet
        visible={sheet === 'leave'}
        title={t('game9.leave.title')}
        lines={[t('game9.leave.body')]}
        onDismiss={() => setSheet('none')}
        testID="game9-leave-sheet"
        actions={[
          {
            label: t('game9.keepPlaying'),
            testID: 'game9-leave-stay',
            onPress: () => setSheet('none'),
          },
          {
            label: t('game9.leave.confirm'),
            variant: 'secondary',
            testID: 'game9-leave-confirm',
            onPress: leave,
          },
        ]}
      />
    </View>
  );
}

function MarkCount({ count, onClear }: { count: number; onClear: (() => void) | null }) {
  const { t } = useTranslation();
  return (
    <View style={styles.markRow}>
      <Text
        maxFontSizeMultiplier={textScale.hud}
        style={styles.markCount}
        testID="game9-mark-count"
      >
        {t('practice.mark.count', { count })}
      </Text>
      {onClear ? (
        <Button
          maxFontSizeMultiplier={textScale.hud}
          label={t('practice.mark.clear')}
          variant="text"
          onPress={onClear}
          testID="game9-mark-clear"
        />
      ) : null}
    </View>
  );
}

function GameBoard({
  s,
  width,
  send,
  onPlay,
  pending,
}: {
  s: GameSession;
  width: number;
  send: (event: GameEvent) => void;
  /** A legal lift while playing: plays, or (Confirm each move) keeps the preview. */
  onPlay: (point: Point) => void;
  pending: Point | null;
}) {
  const { t } = useTranslation();
  const atariLabel = t('game9.a11y.atari');
  const size = s.size;
  const points = (vertices: readonly string[]): Point[] =>
    vertices.map((v) => parseVertex(v, size));

  if (s.phase === 'count' && s.count) {
    return (
      <GoBoard
        size={size}
        stones={countStones(s.game.board.cells, s.count.dead)}
        width={width}
        showCoordinates
        highlights={countHighlights(s.count.score, s.game.board.cells, s.count.dead)}
        sound={false}
        announce={false}
        testID="game9-board"
      />
    );
  }

  if (s.phase === 'mark') {
    const markers: Marker[] = [...s.marks, ...(s.dispute?.points ?? [])].map((v) => ({
      kind: 'dead',
      point: parseVertex(v, size),
    }));
    const highlights: Highlight[] = [];
    if (s.flash.length > 0) highlights.push({ kind: 'error', points: points(s.flash) });
    if (s.dispute) highlights.push({ kind: 'hint', points: points(s.dispute.points) });
    return (
      <GoBoard
        size={size}
        stones={s.game.board.cells}
        width={width}
        showCoordinates
        interactive
        disabled={s.dispute !== null}
        pointer="ring"
        checkPoint={ALWAYS_LEGAL}
        onPlay={(p) => {
          if (s.game.board.cells[p.y * size + p.x] !== null)
            send({ type: 'mark', at: toVertex(p, size) });
        }}
        markers={markers}
        highlights={highlights}
        sound={false}
        announce={false}
        testID="game9-board"
      />
    );
  }

  const last = s.last;
  const hintAt = s.phase === 'playing' ? (s.coach.hint?.point ?? null) : null;
  const danger = visibleDanger(s);
  const markers: Marker[] = danger.map((g) => ({
    kind: 'diamond',
    point: g.liberty,
    tone: g.color === s.learner ? 'danger' : 'chance',
  }));
  if (hintAt) markers.push({ kind: 'diamond', point: hintAt, tone: 'hint' });
  // Own groups: solid rouge ring; White groups: dashed tea-green ring (AC 30–31).
  const highlights: Highlight[] = danger.map((g) => ({
    kind: g.color === s.learner ? 'error' : 'success',
    points: g.stones,
    dashed: g.color !== s.learner,
    label: atariLabel,
  }));
  const lastCapture: CaptureEvent | null =
    last && last.captured.length > 0
      ? { id: last.id, color: last.color === 'B' ? 'W' : 'B', points: last.captured }
      : null;
  return (
    <GoBoard
      size={size}
      stones={s.game.board.cells}
      width={width}
      showCoordinates
      interactive={s.phase === 'playing'}
      disabled={s.thinking || s.phase !== 'playing'}
      playerColor={s.learner}
      checkPoint={(p) => checkGameMove(s.game, p)}
      onPlay={onPlay}
      pending={pending}
      onIllegal={(point) => send({ type: 'play', point })}
      // Touch-down (mouse or finger) starts the next turn: old notes and an illegal reason clear.
      onTouchDown={() => send({ type: 'touch' })}
      lastMove={last?.point ?? null}
      lastCapture={lastCapture}
      markers={markers.length > 0 ? markers : undefined}
      highlights={highlights.length > 0 ? highlights : undefined}
      announce={false}
      testID="game9-board"
    />
  );
}

/**
 * The one shared card under the board while playing (M6-beginner-friendly §8): an illegal-move
 * reason, else the atari line, else the hint, else the coaching notes, else the other notes. With
 * the atari line one more line fits below it (the hint, else the latest note).
 */
function playingLines(
  s: GameSession,
  say: (note: Note) => string,
  more: (n: number) => string,
): FeedbackText[] {
  if (s.note && s.note.key.startsWith('game.fb.illegal.')) {
    return [{ text: say(s.note), tone: toneOf(s.note) }];
  }
  const line = atariLine(visibleDanger(s), s.learner, s.size);
  const rest: FeedbackText[] = s.coach.hint
    ? [{ text: say(s.coach.hint.note), tone: 'success' }]
    : s.coach.notes.length > 0
      ? s.coach.notes.map((note) => ({ text: say(note), tone: 'hint' }))
      : s.note
        ? [{ text: say(s.note), tone: toneOf(s.note) }]
        : [];
  if (!line) return rest;
  const own = line.note.key.startsWith('game9.atari.you.');
  const text = line.more > 0 ? `${say(line.note)}${more(line.more)}` : say(line.note);
  return [{ text, tone: own ? 'error' : 'success' }, ...rest.slice(-1)];
}

function Bottom({
  s,
  say,
  n,
  send,
  onPass,
  onTakeBack,
  onAgain,
  nextHandicap: next,
  confirmMoves,
  canConfirm,
  onConfirmPlay,
  onCountNow,
  onResign,
  onChangeLevel,
  onHome,
  onReview,
}: {
  s: GameSession;
  say: (note: Note) => string;
  n: (value: number) => string;
  send: (event: GameEvent) => void;
  onPass: () => void;
  onTakeBack: () => void;
  onAgain: () => void;
  nextHandicap: Handicap;
  confirmMoves: boolean;
  canConfirm: boolean;
  onConfirmPlay: () => void;
  onCountNow: () => void;
  onResign: () => void;
  onChangeLevel: () => void;
  onHome: () => void;
  onReview: () => void;
}) {
  const { t, i18n } = useTranslation();
  const feedback: FeedbackText[] = s.note ? [{ text: say(s.note), tone: toneOf(s.note) }] : [];
  // "+2 more in atari." joins the line (no space in Chinese).
  const more = (count: number) =>
    `${i18n.language.startsWith('zh') ? '' : ' '}${t('game9.atari.more', { n: count })}`;

  if (s.phase === 'playing') {
    const locked = s.thinking;
    const { hintsLeft } = s.coach;
    const left = s.takebacksLeft;
    return (
      <>
        <FeedbackCard lines={playingLines(s, say, more)} height={NOTE_CARD_HEIGHT} />
        <View style={styles.spacer} />
        {/* Hint ("before I move") left, Take back 悔棋 ("after I moved") right (§5.2). With
            "Confirm each move" the Play button takes the Hint slot (M6b §5.2). */}
        <View style={styles.row}>
          {confirmMoves ? (
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={t('game.confirm.play')}
              onPress={onConfirmPlay}
              disabled={locked || !canConfirm}
              testID="game-confirm-play"
              style={styles.flex}
            />
          ) : (
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={
                hintsLeft === null
                  ? t('coach.hint.buttonFree')
                  : t('coach.hint.button', { n: n(hintsLeft) })
              }
              variant="secondary"
              onPress={() => send({ type: 'hint' })}
              disabled={locked || hintsLeft === 0}
              accessibilityLabel={hintsLeft === 0 ? t('coach.hint.none') : undefined}
              testID="game9-hint"
              style={styles.flex}
            />
          )}
          <Button
            maxFontSizeMultiplier={textScale.hud}
            label={left === null ? t('game9.btn.takeback') : t('game9.btn.takebackN', { n: left })}
            variant="secondary"
            onPress={onTakeBack}
            disabled={!canTakeBack(s)}
            testID="game9-takeback"
            style={styles.flex}
          />
        </View>
        <View style={styles.row}>
          <Button
            maxFontSizeMultiplier={textScale.hud}
            label={t('game9.btn.pass')}
            variant="secondary"
            onPress={onPass}
            disabled={locked}
            testID="game9-pass"
            style={styles.flex}
          />
          {s.game.moves.length >= 6 ? (
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={t('game9.btn.count')}
              variant="secondary"
              onPress={onCountNow}
              disabled={locked || !canCountNow(s)}
              testID="game9-count-now"
              style={styles.flex}
            />
          ) : null}
          <Button
            maxFontSizeMultiplier={textScale.hud}
            label={t('game9.btn.resign')}
            variant="secondary"
            onPress={onResign}
            disabled={locked && !canResignWhileThinking(s)}
            testID="game9-resign"
            style={styles.flex}
          />
        </View>
      </>
    );
  }

  if (s.phase === 'mark') {
    return (
      <>
        <FeedbackCard lines={s.dispute ? [] : feedback} />
        <View style={styles.spacer} />
        <Button
          maxFontSizeMultiplier={textScale.hud}
          label={t('game9.mark.done')}
          onPress={() => send({ type: 'markDone' })}
          disabled={s.dispute !== null}
          testID="game9-mark-done"
        />
      </>
    );
  }

  if (s.phase === 'count' && s.count) {
    return (
      <>
        {s.count.hypothetical ? (
          <Text
            maxFontSizeMultiplier={textScale.hud}
            style={styles.caption}
            testID="game9-hypothetical"
          >
            {t('game9.result.hypothetical')}
          </Text>
        ) : null}
        <CountTable score={s.count.score} n={n} />
        <View style={styles.spacer} />
        <Button
          maxFontSizeMultiplier={textScale.hud}
          label={t('game9.mark.done')}
          onPress={() => send({ type: 'countDone' })}
          testID="game9-count-done"
        />
      </>
    );
  }

  // Result (AC 33, 34).
  const outcome = outcomeOf(s);
  const fact = lossFact(s);
  const margin =
    s.result?.kind === 'count' ? say(winnerNote(s.result.winner, s.result.margin)) : null;
  const level = t(`game9.level.${s.level}.short`);
  // After a resign the status line already says "You resigned. White wins." — the card says it
  // once more only as the outcome, so the sentence is not shown twice.
  const title: Note = outcome === 'resigned' ? { key: 'game9.result.lose' } : statusOf(s);
  return (
    <>
      <View style={styles.resultCard} testID={`game9-result-${outcome ?? 'none'}`}>
        <View
          style={[
            styles.resultDot,
            { backgroundColor: outcome === 'win' ? color.success : color.textSecondary },
          ]}
        />
        <View style={styles.resultText}>
          <Text
            maxFontSizeMultiplier={textScale.hud}
            style={styles.resultTitle}
            accessibilityRole="header"
          >
            {say(title)}
          </Text>
          {margin ? (
            <Text
              maxFontSizeMultiplier={textScale.hud}
              style={styles.resultBody}
            >{`${margin} · ${level}`}</Text>
          ) : null}
          {fact ? (
            <Text maxFontSizeMultiplier={textScale.hud} style={styles.resultDetail}>
              {say(fact)}
            </Text>
          ) : null}
        </View>
      </View>
      {/* The next game's handicap 让子 (M6-beginner-friendly AC 12, §5.4). */}
      <Text
        maxFontSizeMultiplier={textScale.hud}
        style={styles.caption}
        testID="game9-next-handicap"
      >
        {next > 0 ? t('game9.result.next', { n: next }) : t('game9.result.nextEven')}
      </Text>
      <View style={styles.spacer} />
      {outcome === 'resigned' ? (
        <Button
          maxFontSizeMultiplier={textScale.hud}
          label={t('game9.result.showCount')}
          variant="secondary"
          onPress={() => send({ type: 'showCount' })}
          testID="game9-show-count"
        />
      ) : null}
      {/* Review 复盘 is 9×9 only until M6b-2 (M6b AC 37). */}
      {s.size === 9 && s.game.moves.length >= REVIEW_MIN_MOVES ? (
        // Review 复盘 is the primary action; Change level and Home share the text row (§5.3).
        <>
          <View style={styles.row}>
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={t('coach.review.button')}
              onPress={onReview}
              testID="game9-review"
              style={styles.flex}
            />
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={t('game9.btn.again')}
              variant="secondary"
              onPress={onAgain}
              testID="game9-again"
              style={styles.flex}
            />
          </View>
          <View style={styles.row}>
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={t('game9.btn.level')}
              variant="text"
              onPress={onChangeLevel}
              testID="game9-change-level"
              style={styles.flex}
            />
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={t('game9.btn.home')}
              variant="text"
              onPress={onHome}
              testID="game9-home"
              style={styles.flex}
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={t('game9.btn.again')}
              onPress={onAgain}
              testID="game9-again"
              style={styles.flex}
            />
            <Button
              maxFontSizeMultiplier={textScale.hud}
              label={t('game9.btn.level')}
              variant="secondary"
              onPress={onChangeLevel}
              testID="game9-change-level"
              style={styles.flex}
            />
          </View>
          <Button
            maxFontSizeMultiplier={textScale.hud}
            label={t('game9.btn.home')}
            variant="text"
            onPress={onHome}
            testID="game9-home"
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.sm },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  header: { flex: 1, ...typography.label, color: color.textPrimary },
  move: { ...typography.caption, color: color.textSecondary },
  status: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  statusText: { flex: 1, fontSize: 15, lineHeight: 20, color: color.textPrimary },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  markCount: { ...typography.caption, color: color.textSecondary },
  boardWrap: { alignItems: 'center' },
  spacer: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1, paddingHorizontal: spacing.xs },
  caption: { ...typography.caption, color: color.textSecondary, textAlign: 'center' },
  resultCard: {
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
  resultDot: { width: 8, height: 8, borderRadius: 4, marginTop: 10 },
  resultText: { flex: 1 },
  resultTitle: { ...typography.title, fontSize: 20, lineHeight: 26, color: color.textPrimary },
  resultBody: { fontSize: 14, lineHeight: 20, color: color.textPrimary, marginTop: spacing.xs },
  resultDetail: { ...typography.caption, color: color.textSecondary, marginTop: spacing.xs },
});
