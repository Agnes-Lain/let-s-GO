// Dev/demo screen for <GoBoard/> (spec M2 §5). PR 1: static scenarios only; touch comes in PR 2.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoBoard } from '@/board';
import { SCENARIOS, scenarioBoard, type ScenarioId } from '@/board/scenarios';
import { BOARD_SIZES, type BoardSize } from '@/engine';
import { Screen, TopBar } from '@/theme/Screen';
import { board, color, radius, spacing, stone, tapTarget, typography } from '@/theme/tokens';

const MAX_BOARD = 480;
/** Height of every row except the board (top bar, size control, turn row, message, chips, actions). */
const OTHER_ROWS = 340;

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
  const boardWidth = Math.floor(
    Math.min(
      window.width - 2 * spacing.lg,
      window.height - insets.top - insets.bottom - OTHER_ROWS,
      MAX_BOARD,
    ),
  );

  const chooseSize = (size: BoardSize) => {
    setChosenSize(size);
    setScenarioId('free');
  };

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
          stones={view.stones}
          width={boardWidth}
          showCoordinates={showCoordinates}
          markers={view.markers}
          highlights={view.highlights}
        />
      </View>

      <View style={styles.turnRow}>
        <View
          style={[styles.miniStone, scenario.toPlay === 'B' ? styles.miniBlack : styles.miniWhite]}
        />
        <Text style={styles.turnText}>{t(`dev.board.toPlay.${scenario.toPlay}`)}</Text>
        <Text style={styles.captionText}>{t('dev.board.captures', { black: 0, white: 0 })}</Text>
      </View>

      {/* Reserved for illegal-move messages (PR 2): 72 px so nothing jumps. */}
      <View style={styles.messageSlot} />

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
              onPress={() => setScenarioId(s.id)}
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
          disabled
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          style={[styles.action, styles.actionDisabled]}
        >
          <Text style={styles.actionText}>{t('dev.board.undo')}</Text>
        </Pressable>
        <Pressable
          disabled
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          style={[styles.action, styles.actionDisabled]}
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
