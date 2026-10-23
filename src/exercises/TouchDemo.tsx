// The intro's practice board (docs/specs/M6-settings-onboarding-a11y.md §5.2–5.3, AC 29–31): an
// empty 5×5 board with the real touch handling. Colours alternate; illegal touches get the
// engine's standard message. No stars, no failure state.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { GoBoard, type CaptureEvent } from '@/board';
import type { IllegalReason, MoveFacts, Point } from '@/engine';
import { CheckIcon } from '@/theme/icons';
import { color, spacing, typography } from '@/theme/tokens';

import { checkExerciseMove, playTouchDemo, touchDemoGame } from './engineAdapter';
import { illegalFeedback } from './feedback';

type Message = { kind: 'done' } | { kind: 'illegal'; key: string } | null;

export function TouchDemo({ width, label }: { width: number; label: string }) {
  const { t } = useTranslation();
  const [game, setGame] = useState(touchDemoGame);
  const [facts, setFacts] = useState<MoveFacts | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const onPlay = (p: Point) => {
    const result = playTouchDemo(game, p);
    if (!result.ok) {
      setMessage({ kind: 'illegal', key: illegalFeedback(result.reason)[0].key });
      return;
    }
    setGame(result.state);
    setFacts(result.facts);
    setMessage({ kind: 'done' });
  };
  const onIllegal = (_p: Point, reason: IllegalReason) =>
    setMessage({ kind: 'illegal', key: illegalFeedback(reason)[0].key });

  const lastCapture: CaptureEvent | null =
    facts && facts.captured.length > 0
      ? {
          id: game.moves.length,
          color: facts.color === 'B' ? 'W' : 'B',
          points: facts.captured.flat(),
        }
      : null;

  return (
    <View style={styles.root}>
      <GoBoard
        size={5}
        stones={game.board.cells}
        width={width}
        showCoordinates
        interactive
        playerColor={game.toPlay}
        checkPoint={(p) => checkExerciseMove(game, p)}
        onPlay={onPlay}
        onIllegal={onIllegal}
        lastMove={facts?.point ?? null}
        lastCapture={lastCapture}
        accessibilityLabel={label}
        testID="onboarding-demo-board"
      />
      <View style={styles.feedback} accessibilityLiveRegion="polite">
        {message?.kind === 'done' ? (
          <View style={styles.doneRow}>
            <CheckIcon color={color.success} size={18} />
            <Text
              style={[styles.text, styles.done]}
              maxFontSizeMultiplier={2}
              testID="onboarding-demo-done"
            >
              {t('onboarding.2.done')}
            </Text>
          </View>
        ) : message?.kind === 'illegal' ? (
          <Text
            style={[styles.text, styles.illegal]}
            maxFontSizeMultiplier={2}
            testID="onboarding-demo-illegal"
          >
            {t(message.key)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing.sm },
  feedback: { minHeight: 24, alignSelf: 'stretch', justifyContent: 'center' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  text: { ...typography.body, flexShrink: 1 },
  done: { color: color.success },
  illegal: { color: color.error },
});
