// Dev/demo screen for <GoBoard/> (spec M2 §5). The rules come from the engine; the board only draws.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

import { GoBoard, type CaptureEvent } from '@/board';
import { SCENARIOS, scenarioBoard, type Scenario, type ScenarioId } from '@/board/scenarios';
import {
  BOARD_SIZES,
  checkMove,
  createGame,
  play,
  type BoardSize,
  type GameState,
  type IllegalReason,
  type MoveFacts,
  type Point,
} from '@/engine';
import { Screen, TopBar } from '@/theme/Screen';
import { board, color, radius, spacing, stone, tapTarget, typography } from '@/theme/tokens';

const MAX_BOARD = 480;
/** Height of every row except the board (top bar, size control, turn row, message, chips, actions). */
const OTHER_ROWS = 340;

/** One position in the undo history: the game after a move, plus what that move did. */
interface Entry {
  game: GameState;
  facts: MoveFacts | null;
}

const NO_MESSAGE = null as string | null;

const startEntry = (scenario: Scenario, size: BoardSize): Entry => ({
  game: createGame(size, { setup: scenario.setup, toPlay: scenario.toPlay }),
  facts: null,
});

/** Engine reason -> message text (static keys, so the i18n usage check can see them). */
function illegalMessage(t: TFunction, reason: IllegalReason): string | null {
  switch (reason) {
    case 'occupied':
      return t('engine.illegal.occupied');
    case 'suicide':
      return t('engine.illegal.suicide');
    case 'ko':
      return t('engine.illegal.ko');
    case 'game-over':
      return t('engine.illegal.gameOver');
    case 'off-board':
      return null; // the board never produces this
  }
}

export default function BoardDemoScreen() {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [chosenSize, setChosenSize] = useState<BoardSize>(9);
  const [scenarioId, setScenarioId] = useState<ScenarioId>('free');
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [sound, setSound] = useState(true);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const view = scenarioBoard(scenario, chosenSize);
  const [history, setHistory] = useState(() => [startEntry(SCENARIOS[0], 9)]);
  const [message, setMessage] = useState(NO_MESSAGE);
  const { game, facts } = history[history.length - 1];
  const boardWidth = Math.floor(
    Math.min(
      window.width - 2 * spacing.lg,
      window.height - insets.top - insets.bottom - OTHER_ROWS,
      MAX_BOARD,
    ),
  );

  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  const restart = (next: Scenario, size: BoardSize) => {
    setHistory([startEntry(next, size)]);
    setMessage(null);
  };
  const chooseSize = (size: BoardSize) => {
    setChosenSize(size);
    setScenarioId('free');
    restart(SCENARIOS[0], size);
  };
  const chooseScenario = (next: Scenario) => {
    setScenarioId(next.id);
    restart(next, next.size ?? chosenSize);
  };

  const onPlay = (p: Point) => {
    const result = play(game, p);
    if (!result.ok) return;
    setHistory((h) => [...h, { game: result.state, facts: result.facts }]);
    setMessage(null);
  };
  const onIllegal = (_p: Point, reason: IllegalReason) => setMessage(illegalMessage(t, reason));
  const undo = () => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
    setMessage(null);
  };

  const lastCapture: CaptureEvent | null =
    facts && facts.captured.length > 0
      ? {
          id: game.moves.length,
          color: facts.color === 'B' ? 'W' : 'B',
          points: facts.captured.flat(),
        }
      : null;

  return (
    <Screen>
      <TopBar
        showBack
        title={t('dev.board.title')}
        right={
          <View style={styles.toggles}>
            <Toggle
              label={t('dev.board.coordinates')}
              glyph="A1"
              checked={showCoordinates}
              onPress={() => setShowCoordinates((v) => !v)}
            />
            <Toggle
              label={t('dev.board.sound')}
              glyph="♪"
              checked={sound}
              onPress={() => setSound((v) => !v)}
            />
          </View>
        }
      />

      <View style={styles.segmented}>
        {BOARD_SIZES.map((size) => {
          const selected = scenario.size === null ? size === chosenSize : size === view.size;
          return (
            <Pressable
              key={size}
              onPress={() => chooseSize(size)}
              accessibilityRole="button"
              accessibilityLabel={t('dev.board.sizeA11y', { size })}
              accessibilityState={{ selected }}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {t('dev.board.sizeOption', { size })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.boardSlot, { height: boardWidth }]}>
        <GoBoard
          size={view.size}
          stones={game.board.cells}
          width={boardWidth}
          showCoordinates={showCoordinates}
          interactive
          playerColor={game.toPlay}
          checkPoint={(p) => checkMove(game, p)}
          onPlay={onPlay}
          onIllegal={onIllegal}
          lastMove={facts?.point ?? null}
          lastCapture={lastCapture}
          sound={sound}
          markers={view.markers}
          highlights={view.highlights}
        />
      </View>

      <View style={styles.turnRow}>
        <View
          style={[styles.miniStone, game.toPlay === 'B' ? styles.miniBlack : styles.miniWhite]}
        />
        <Text style={styles.turnText}>{t(`dev.board.toPlay.${game.toPlay}`)}</Text>
        <Text style={styles.captionText}>
          {t('dev.board.captures', { black: game.captures.B, white: game.captures.W })}
        </Text>
      </View>

      {/* Reserved for illegal-move messages: 72 px so nothing jumps. */}
      <View style={styles.messageSlot}>
        {message ? (
          <View testID="board-demo-message" accessibilityLiveRegion="polite" style={styles.message}>
            <View style={styles.messageDot} />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chips}
      >
        {SCENARIOS.map((s) => {
          const selected = s.id === scenarioId;
          return (
            <Pressable
              key={s.id}
              onPress={() => chooseScenario(s)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {t(`dev.board.scenario.${s.id}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          onPress={undo}
          disabled={history.length <= 1}
          accessibilityRole="button"
          accessibilityState={{ disabled: history.length <= 1 }}
          style={[styles.action, history.length <= 1 && styles.actionDisabled]}
        >
          <Text style={styles.actionText}>{t('dev.board.undo')}</Text>
        </Pressable>
        <Pressable
          onPress={() => restart(scenario, view.size)}
          accessibilityRole="button"
          style={styles.action}
        >
          <Text style={styles.actionText}>{t('dev.board.reset')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Toggle({
  label,
  glyph,
  checked,
  onPress,
}: {
  label: string;
  glyph: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      style={[styles.toggle, checked && styles.toggleOn]}
    >
      <Text style={[styles.toggleText, checked && styles.toggleTextOn]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggles: { flexDirection: 'row' },
  toggle: {
    width: tapTarget.min,
    height: tapTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  toggleOn: { backgroundColor: color.badge },
  toggleText: { ...typography.label, color: color.textSecondary },
  toggleTextOn: { color: color.accent },
  segmented: {
    flexDirection: 'row',
    height: tapTarget.min,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: tapTarget.min },
  segmentSelected: { backgroundColor: color.accent },
  segmentText: { ...typography.label, color: color.textPrimary },
  segmentTextSelected: { color: color.onAccent },
  boardSlot: { alignItems: 'center', justifyContent: 'center' },
  turnRow: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  miniStone: { width: 14, height: 14, borderRadius: 7 },
  miniBlack: { backgroundColor: stone.black },
  miniWhite: { backgroundColor: stone.white, borderWidth: 1, borderColor: stone.whiteEdge },
  turnText: { ...typography.label, color: color.textPrimary, flex: 1 },
  captionText: { ...typography.caption, color: color.textSecondary },
  messageSlot: { height: 72, marginVertical: spacing.xs },
  message: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
  },
  messageDot: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 4,
    backgroundColor: color.error,
  },
  messageText: { ...typography.caption, flex: 1, color: color.textPrimary },
  chipScroll: { flexGrow: 0, minHeight: tapTarget.min },
  chips: { gap: spacing.sm, alignItems: 'center' },
  chip: {
    minHeight: tapTarget.min,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: board.line,
    backgroundColor: color.surface,
  },
  chipSelected: { backgroundColor: color.accent, borderColor: color.accent },
  chipText: { ...typography.label, color: color.textPrimary },
  chipTextSelected: { color: color.onAccent },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  action: {
    flex: 1,
    minHeight: tapTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: color.accent,
  },
  actionDisabled: { opacity: 0.4 },
  actionText: { ...typography.label, color: color.onAccent },
});
