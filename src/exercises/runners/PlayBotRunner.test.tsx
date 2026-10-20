// The Capture Go game screen (spec docs/specs/M4-bot-capture-go.md §5, ACs 43–54, 56, 57,
// 66, 67, 69) with hand-made games, so the bot's replies are known.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, processColor } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { boardGeometry } from '@/board';
import { setLanguageChoice } from '@/i18n';
import type { Lesson, PlayBotExercise } from '@/lessons';
import { stone } from '@/theme/tokens';

import {
  advance,
  feedbackText,
  hidden,
  reduceMotion,
  settle,
  tap,
  texts,
} from '../__fixtures__/practiceDriver';
import { BOT_DELAY_MS, BOT_DELAY_REDUCED_MS, END_BEAT_MS } from '../botGame';
import { PlayBotRunner } from './PlayBotRunner';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
// A 360×740 phone (AC 57, 68).
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

function game(extra: Partial<PlayBotExercise> = {}): PlayBotExercise {
  return {
    id: 'g',
    type: 'play-bot',
    size: 5,
    setup: { B: ['b3', 'c2', 'd3'], W: ['c3'] },
    win: { kind: 'captureN', n: 1 },
    bot: { level: 1, blunder: 0, seed: 1 },
    promptKey: 'lesson.u06-capture-go.e1.prompt',
    hintKey: 'lesson.u06-capture-go.e1.hint',
    explainKey: 'lesson.u06-capture-go.e1.explain',
    ...extra,
  };
}

/** Black c3 is in atari (liberty c4); a blunder-free bot captures it unless Black extends. */
const LOSABLE = game({
  setup: { B: ['c3', 'a5'], W: ['b3', 'd3', 'c2'] },
  win: { kind: 'captureN', n: 1 },
});

function lessonOf(...exercises: PlayBotExercise[]): Lesson {
  return {
    schema: 1,
    id: 'u06-test',
    unit: 6,
    kind: 'checkpoint',
    titleKey: 'lesson.u06-checkpoint.title',
    exercises: exercises.map((e, i) => ({ ...e, id: `g${i}` })),
  };
}

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
/** Position of the element with `testID` in render (top-to-bottom) order. */
function treeIndex(testID: string): number {
  const ids: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { props?: { testID?: string }; children?: unknown[] };
    if (n.props?.testID) ids.push(n.props.testID);
    (n.children ?? []).forEach(walk);
  };
  walk(screen.toJSON());
  return ids.indexOf(testID);
}
const isAscending = (list: number[]) =>
  list.every((v, i) => v >= 0 && (i === 0 || v > list[i - 1]));

const onDone = jest.fn();
const onClose = jest.fn();

async function show(exercise: PlayBotExercise, index = 0, total = 2) {
  const lesson = lessonOf(...Array.from({ length: total }, () => exercise));
  const view = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <PlayBotRunner
        exercise={lesson.exercises[index] as PlayBotExercise}
        lesson={lesson}
        index={index}
        onClose={onClose}
        onDone={onDone}
      />
    </SafeAreaProvider>,
  );
  await settle();
  return view;
}

/** Stones of one colour on the board (captured stones fading out are not counted). */
const stones = (color: 'black' | 'white') => {
  const fill = processColor(color === 'black' ? stone.black : stone.white);
  return screen
    .queryAllByTestId(/^board-stone-[a-t]\d+$/, hidden)
    .filter((n) => (n.props.fill as { payload?: unknown } | undefined)?.payload === fill).length;
};
const pill = () => screen.queryByTestId('game-turn-you') ?? screen.queryByTestId('game-turn-bot');

beforeEach(async () => {
  jest.useFakeTimers();
  reduceMotion(false);
  onDone.mockClear();
  onClose.mockClear();
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('turns and the bot delay (AC 43–45)', () => {
  it('AC 43: learner first — "Your turn", board accepts input', async () => {
    await show(game());
    expect(pill()?.props.testID).toBe('game-turn-you');
    expect(screen.getByText('Your turn')).toBeOnTheScreen();
    expect(screen.getByTestId('practice-board')).toBeTruthy();
  });

  it('AC 43: bot first (G5) — "Bot is thinking", the bot stone appears after BOT_DELAY_MS', async () => {
    await show(
      game({
        setup: { B: ['c4', 'd3'], W: ['d4', 'c3'] },
        size: 7,
        player: 'W',
        win: { kind: 'captureN', n: 3 },
      }),
    );
    expect(screen.getByText('Bot is thinking')).toBeOnTheScreen();
    expect(stones('black')).toBe(2);
    await advance(BOT_DELAY_MS - 1);
    expect(stones('black')).toBe(2);
    await advance(1);
    expect(stones('black')).toBe(3);
    expect(screen.getByText('Your turn')).toBeOnTheScreen();
  });

  it('AC 44: the learner stone is shown at once; the bot answers no earlier than 700 ms', async () => {
    await show(game({ win: { kind: 'captureN', n: 2 }, bot: { level: 1, blunder: 0, seed: 1 } }));
    await tap('a1');
    expect(stones('black')).toBe(4);
    expect(screen.getByText('Bot is thinking')).toBeOnTheScreen();
    expect(screen.getByTestId('game-thinking-dots')).toBeTruthy();
    // Input is ignored while the bot thinks.
    await tap('e5');
    expect(stones('black')).toBe(4);
    await advance(BOT_DELAY_MS - 1);
    expect(stones('white')).toBe(1);
    await advance(1);
    expect(screen.getByText('Your turn')).toBeOnTheScreen();
    // The bot saved c3 (blunder 0): two white stones now.
    expect(stones('white')).toBe(2);
  });

  it('AC 44, 67: with Reduce Motion the delay is 300 ms and the dots do not animate', async () => {
    reduceMotion(true);
    await show(game({ win: { kind: 'captureN', n: 2 } }));
    await tap('a1');
    const dots = screen.getAllByTestId('game-thinking-dots')[0];
    const opacities = dots.children.map(
      (d) =>
        (
          StyleSheet.flatten(
            (d as unknown as { props: { style: unknown } }).props.style as never,
          ) as {
            opacity?: unknown;
          }
        ).opacity,
    );
    expect(opacities.every((o) => typeof o === 'number')).toBe(true);
    await advance(BOT_DELAY_REDUCED_MS - 1);
    expect(stones('white')).toBe(1);
    await advance(1);
    expect(stones('white')).toBe(2);
  });

  it('AC 45: leaving during the delay cancels the timer (no update after unmount)', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const view = await show(game({ win: { kind: 'captureN', n: 2 } }));
    await tap('a1');
    const clear = jest.spyOn(global, 'clearTimeout');
    view.unmount();
    expect(clear).toHaveBeenCalled();
    await advance(BOT_DELAY_MS * 2);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('the end of a game (AC 46, 47, 52–54, 56)', () => {
  it('AC 46, 56: G1 c4 captures, 1 / 1, no bot move, the win card 600 ms later', async () => {
    await show(game());
    await tap('c4');
    expect(stones('white')).toBe(0);
    expect(screen.getByTestId('game-score-you').props.accessibilityLabel).toBe(
      'Your captures: 1 of 1',
    );
    expect(screen.getAllByTestId('game-score-you-slot-filled')).toHaveLength(1);
    expect(screen.queryByTestId('game-win')).toBeNull();
    await advance(END_BEAT_MS);
    expect(screen.getByTestId('game-win')).toBeTruthy();
    expect(screen.getByText('You win!')).toBeOnTheScreen();
    expect(screen.getByText('You captured 1 first.')).toBeOnTheScreen();
    expect(screen.getByText(texts['lesson.u06-capture-go.e1.explain'])).toBeOnTheScreen();
    expect(stones('black')).toBe(4); // the bot did not move
    fireEvent.press(screen.getByTestId('game-next'));
    expect(onDone).toHaveBeenCalledWith('clean');
  });

  it('AC 52: the last game says Finish', async () => {
    await show(game(), 1, 2);
    await tap('c4');
    await advance(END_BEAT_MS);
    expect(screen.getByTestId('game-finish')).toBeTruthy();
  });

  it('AC 47, 53: the bot captures → lose card 600 ms later with the engine fact', async () => {
    await show(LOSABLE);
    await tap('e1');
    await advance(BOT_DELAY_MS);
    expect(screen.queryByTestId('game-lose')).toBeNull();
    await advance(END_BEAT_MS);
    expect(screen.getByTestId('game-lose')).toBeTruthy();
    expect(screen.getByText('Not this time')).toBeOnTheScreen();
    expect(screen.getByText('The bot captured 1 first.')).toBeOnTheScreen();
    expect(
      screen.getByText('Your stones at c3 had one liberty (c4) and the bot filled it.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('game-retry')).toBeTruthy();
    expect(screen.queryByTestId('game-skip')).toBeNull();
  });

  it('AC 54: Try again starts a fresh game; AC 29, 53: Skip after the 3rd loss gives revealed', async () => {
    await show(LOSABLE);
    for (let loss = 1; loss <= 3; loss++) {
      await tap('e1');
      await advance(BOT_DELAY_MS);
      await advance(END_BEAT_MS);
      // The eased bot may blunder: then extend into the corner until it captures.
      for (
        let i = 0;
        i < 20 && !screen.queryByTestId('game-lose') && !screen.queryByTestId('game-win');
        i++
      ) {
        await tap(['e2', 'e3', 'e4', 'd1', 'd5', 'b1', 'b5', 'a1'][i % 8]);
        await advance(BOT_DELAY_MS + END_BEAT_MS);
      }
      expect(screen.getByTestId('game-lose')).toBeTruthy(); // seeds 1–3: the bot captures
      if (loss < 3) {
        expect(screen.queryByTestId('game-skip')).toBeNull();
        fireEvent.press(screen.getByTestId('game-retry'));
        await settle();
        expect(screen.getByText('Your turn')).toBeOnTheScreen();
        expect(stones('black')).toBe(2);
        expect(screen.getAllByTestId(/^segment-/)).toHaveLength(2);
      }
    }
    expect(screen.getByTestId('game-skip')).toBeTruthy();
    fireEvent.press(screen.getByTestId('game-skip'));
    expect(onDone).toHaveBeenCalledWith('revealed');
  });

  it('a draw at the move limit shows the draw card at once', async () => {
    await show(
      game({
        setup: { B: ['c3', 'd2'], W: ['d3', 'c2'] },
        maxMoves: 2,
        win: { kind: 'captureN', n: 3 },
      }),
    );
    await tap('a1');
    await advance(BOT_DELAY_MS);
    expect(screen.getByTestId('game-draw')).toBeTruthy();
    expect(screen.getByText('Nobody reached 3 captures.')).toBeOnTheScreen();
  });
});

describe('score, notes and hint (AC 48–51, 57, 69)', () => {
  it('AC 48: two halves; colours swap when the learner plays White', async () => {
    await show(
      game({
        setup: { B: ['c4', 'd3'], W: ['d4', 'c3'] },
        size: 7,
        player: 'W',
        win: { kind: 'captureN', n: 3 },
      }),
    );
    expect(within(screen.getByTestId('game-score-you')).getByText('White')).toBeOnTheScreen();
    expect(within(screen.getByTestId('game-score-bot')).getByText('Black')).toBeOnTheScreen();
    expect(screen.getAllByTestId('game-score-you-slot-empty')).toHaveLength(3);
    expect(screen.getByTestId('game-score-bot').props.accessibilityLabel).toBe(
      "Bot's captures: 0 of 3",
    );
  });

  it('AC 48: the active half has the accent border', async () => {
    await show(game({ win: { kind: 'captureN', n: 2 } }));
    const width = (id: string) =>
      StyleSheet.flatten(screen.getByTestId(id).props.style).borderWidth;
    expect(width('game-score-you')).toBe(2);
    expect(width('game-score-bot')).toBe(1);
    await tap('a1');
    expect(width('game-score-you')).toBe(1);
    expect(width('game-score-bot')).toBe(2);
  });

  it('AC 49: after the bot plays, a learner group in atari is named with its liberty', async () => {
    // Black c3 next to White b3 d3: the blunder-free bot ataris it at c2 or c4.
    await show(
      game({
        setup: { B: ['c3'], W: ['b3', 'd3'] },
        win: { kind: 'captureN', n: 2 },
        bot: { level: 1, blunder: 0, seed: 1 },
      }),
    );
    await tap('c5');
    await advance(BOT_DELAY_MS);
    expect(feedbackText()).toMatch(/^Atari! Your stones at c3 have one liberty left: c[24]\.$/);
  });

  it('AC 49: the learner puts a bot group in atari', async () => {
    await show(
      game({ setup: { B: ['c3', 'd2'], W: ['d3', 'c2'] }, win: { kind: 'captureN', n: 2 } }),
    );
    await tap('e3');
    expect(feedbackText()).toBe("The bot's stones at d3 are in atari: one liberty left.");
  });

  it('AC 50: the learner captures (game goes on)', async () => {
    await show(game({ win: { kind: 'captureN', n: 2 } }));
    await tap('c4');
    expect(feedbackText()).toBe('You captured 1.');
  });

  it('AC 23: an illegal tap explains itself and changes nothing', async () => {
    await show(
      game({ setup: { B: ['c3', 'd2'], W: ['a2', 'b1'] }, win: { kind: 'captureN', n: 2 } }),
    );
    await tap('a1');
    expect(feedbackText()).toBe(texts['game.fb.illegal.suicide']);
    expect(stones('black')).toBe(2);
    expect(screen.getByText('Your turn')).toBeOnTheScreen();
  });

  // Updated by M5 item 3 (M5-life-death AC 42): the goal is a card above the board for the whole
  // game; the feedback card below no longer repeats it.
  it('AC 42: the goal card is above the score row and the board, before and after a move', async () => {
    await show(game());
    const goal = () => screen.getByTestId('game-goal');
    expect(goal()).toHaveTextContent(texts['lesson.u06-capture-go.e1.prompt']);
    expect(feedbackText()).toBe('');
    const order = () =>
      ['game-goal', 'game-score-you', 'practice-board', 'practice-feedback'].map((id) =>
        treeIndex(id),
      );
    expect(isAscending(order())).toBe(true);
    await tap('e5');
    expect(goal()).toHaveTextContent(texts['lesson.u06-capture-go.e1.prompt']);
    expect(feedbackText()).not.toContain(texts['lesson.u06-capture-go.e1.prompt']);
    expect(isAscending(order())).toBe(true);
  });

  it('AC 51: Hint shows the tip, the engine sentence and pulses the point; it costs clean', async () => {
    await show(game());
    fireEvent.press(screen.getByTestId('practice-hint'));
    expect(feedbackText()).toBe(`${texts['lesson.u06-capture-go.e1.hint']} You can capture at c4.`);
    expect(screen.queryAllByTestId(/^board-highlight-hint/, hidden).length).toBeGreaterThan(0);
    expect(screen.getByTestId('practice-hint').props.accessibilityState).toMatchObject({
      disabled: true,
      expanded: true,
    });
    await tap('c4');
    await advance(END_BEAT_MS);
    fireEvent.press(screen.getByTestId('game-next'));
    expect(onDone).toHaveBeenCalledWith('solved');
  });

  it('AC 51: the hint is not available while the bot thinks', async () => {
    await show(game({ win: { kind: 'captureN', n: 2 } }));
    await tap('a1');
    expect(screen.getByTestId('practice-hint').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('AC 57: 5×5 and 7×7 boards are 328 px at 360×740; points ≥ 44 px apart', async () => {
    await show(game());
    const width = StyleSheet.flatten(screen.getByTestId('practice-board').props.style).width;
    expect(width).toBeLessThanOrEqual(328);
    expect(boardGeometry(5, 328, false).cell).toBeGreaterThanOrEqual(44);
    expect(boardGeometry(7, 328, false).cell).toBeGreaterThanOrEqual(44);
  });

  it('restart mid-game gives a fresh board', async () => {
    await show(game({ win: { kind: 'captureN', n: 2 } }));
    await tap('a1');
    await advance(BOT_DELAY_MS);
    fireEvent.press(screen.getByTestId('game-restart'));
    await settle();
    expect(stones('black')).toBe(3);
    expect(stones('white')).toBe(1);
  });
});

describe('screen reader (AC 66)', () => {
  it('announces the bot move and its captures', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await show(LOSABLE);
    await tap('e1');
    await advance(BOT_DELAY_MS);
    expect(announce).toHaveBeenCalledWith('Bot played c4. Stones captured: 1');
    await advance(END_BEAT_MS);
    expect(announce).toHaveBeenCalledWith(
      expect.stringMatching(/^Not this time The bot captured 1 first\./),
    );
  });

  it('the turn pill is a polite live region; Hint / Try again / Next are labelled buttons', async () => {
    await show(game());
    expect(screen.getByTestId('game-turn-you').props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByRole('button', { name: 'Hint' })).toBeOnTheScreen();
    await tap('c4');
    await advance(END_BEAT_MS);
    expect(screen.getByRole('button', { name: 'Next game' })).toBeOnTheScreen();
  });
});
