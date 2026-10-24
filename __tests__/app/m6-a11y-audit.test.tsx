// Accessibility pass (docs/specs/M6-settings-onboarding-a11y.md §4.5): the shared audit on every
// screen (AC 35), one header per screen (AC 36), feedback heard once (AC 39), no text under 12 px
// (AC 40) and the text-size caps (AC 42).
import { render } from '@testing-library/react-native';
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import { ExerciseView } from '@/exercises/ExerciseView';
import { ResultView } from '@/exercises/ResultView';
import { BOT_DELAY_MS } from '@/game9/session';
import { setLanguageChoice } from '@/i18n';
import { loadLesson, type Lesson } from '@/lessons';
import { progressStore } from '@/store';
import { accessibilityViolations, expectAccessible } from '@/theme/__fixtures__/expectAccessible';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'fr-FR', languageCode: 'fr' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const settle = () => act(async () => {});
const advance = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
const root = () => screen.UNSAFE_root;
const SIX = Array(6).fill('clean') as 'clean'[];

/** Host Text nodes (what reaches the screen). */
function hostTexts(node: ReactTestInstance): ReactTestInstance[] {
  return node.findAll((n) => (n.type as unknown) === 'Text', { deep: true });
}
/** Text nodes under 12 px, as "size: text". */
function smallTexts(node: ReactTestInstance): string[] {
  return hostTexts(node)
    .map((n) => ({ size: StyleSheet.flatten(n.props.style)?.fontSize, n }))
    .filter(({ size }) => typeof size === 'number' && size < 12)
    .map(({ size, n }) => `${size}: ${[n.props.children].flat().join('')}`);
}
/** Text nodes whose cap is missing or above `max`. */
function uncapped(node: ReactTestInstance, max: number): string[] {
  return hostTexts(node)
    .filter((n) => !(typeof n.props.maxFontSizeMultiplier === 'number'))
    .concat(hostTexts(node).filter((n) => n.props.maxFontSizeMultiplier > max))
    .map((n) => [n.props.children].flat().join(''));
}
const headers = () => screen.getAllByRole('header');

async function openAt(url: string) {
  const router = await renderRouter('./app', { initialUrl: '/' });
  await settle();
  if (url !== '/') {
    await act(() => appRouter.push(url));
    await settle();
  }
  return router;
}

async function tapGame(vertex: string) {
  const board = screen.getByTestId('game9-board');
  const width = StyleSheet.flatten(board.props.style).width as number;
  const g = boardGeometry(9, width, true);
  const { x, y } = pointToLocation(g, parseVertex(vertex, 9));
  const event = { nativeEvent: { locationX: x, locationY: y } };
  await act(async () => {
    fireEvent(screen.getByTestId('board-touch'), 'responderGrant', event);
  });
  await act(async () => {
    fireEvent(screen.getByTestId('board-touch'), 'responderRelease', event);
  });
}

function lessonOf(id: string): Lesson {
  const result = loadLesson(id);
  if (!result.ok) throw new Error(`lesson ${id} does not load`);
  return result.lesson;
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.25);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  progressStore.getState().reset();
  progressStore.getState().setFlag('onboardingSeen');
  // French: the longest copy.
  await act(() => setLanguageChoice('fr'));
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await act(() => setLanguageChoice('system'));
});

describe('the audit helper (AC 35)', () => {
  it('flags a pressable without a role, a name, or 44 px', () => {
    const { Pressable, Text } = jest.requireActual('react-native');
    const view = render(
      <>
        <Pressable onPress={() => {}} style={{ minHeight: 44 }} testID="no-role">
          <Text>Go</Text>
        </Pressable>
        <Pressable
          onPress={() => {}}
          accessibilityRole="button"
          style={{ height: 44 }}
          testID="no-name"
        />
        <Pressable
          onPress={() => {}}
          accessibilityRole="button"
          accessibilityLabel="x"
          style={{ height: 31 }}
          testID="small"
        />
        <Pressable
          onPress={() => {}}
          accessibilityRole="button"
          accessibilityLabel="slop"
          style={{ height: 30, width: 30 }}
          hitSlop={7}
          testID="slop"
        />
      </>,
    );
    const problems = accessibilityViolations(view.UNSAFE_root).map(
      (v) => `${v.testID}: ${v.problem}`,
    );
    expect(problems).toEqual([
      'no-role: no accessibilityRole',
      'no-name: no label or text',
      'small: height 31 < 44',
    ]);
    view.unmount();
  });
});

describe('every screen passes the audit (AC 35, 36, 40, 42)', () => {
  it('Landing page (§12c.1)', async () => {
    await openAt('/');
    expectAccessible(root());
    expect(headers()).toHaveLength(1);
    expect(smallTexts(root())).toEqual([]);
    expect(uncapped(root(), 2)).toEqual([]);
  });

  it('Learning page (all modules open)', async () => {
    await openAt('/learn');
    await press('home-module-2');
    await press('home-module-3');
    expectAccessible(root());
    expect(headers()).toHaveLength(1);
    expect(uncapped(root(), 2)).toEqual([]);
  });

  it('Settings and the reset sheet', async () => {
    await openAt('/settings');
    expectAccessible(root());
    expect(headers()).toHaveLength(1);
    expect(smallTexts(root())).toEqual([]);
    expect(uncapped(root(), 2)).toEqual([]);
    await press('settings-reset');
    expectAccessible(root());
    expect(uncapped(root(), 2)).toEqual([]);
  });

  it('Onboarding, both steps', async () => {
    progressStore.getState().reset();
    await openAt('/');
    await press('landing-start');
    expect(screen.getByTestId('onboarding-step-1')).toBeOnTheScreen();
    expectAccessible(root());
    expect(headers()).toHaveLength(1);
    expect(smallTexts(root())).toEqual([]);
    expect(uncapped(root(), 2)).toEqual([]);
    await press('onboarding-next');
    expectAccessible(root());
    expect(headers()).toHaveLength(1);
    expect(smallTexts(root())).toEqual([]);
  });

  it('9×9 picker: the chips, the atari row (now ≥ 52 px) and the 12 px "suggested" tag', async () => {
    await openAt('/game');
    expectAccessible(root());
    expect(headers()).toHaveLength(1);
    expect(smallTexts(root())).toEqual([]);
    expect(uncapped(root(), 2)).toEqual([]);
    const tag = screen.getAllByTestId(/^game9-handicap-\d-suggested$/)[0];
    expect(StyleSheet.flatten(tag.props.style).fontSize).toBe(12);
  });

  it('9×9 game: playing, marking, result (HUD capped at 1.3)', async () => {
    await openAt('/game/play?level=1');
    expectAccessible(root());
    expect(smallTexts(root())).toEqual([]);
    expect(uncapped(screen.getByTestId('game9-status'), 1.3)).toEqual([]);
    expect(uncapped(screen.getByTestId('practice-feedback'), 1.3)).toEqual([]);
    for (const v of ['e5', 'd4', 'c3']) {
      await tapGame(v);
      await advance(BOT_DELAY_MS + 50);
    }
    await press('game9-count-now');
    await press('game9-count-confirm');
    expectAccessible(root());
    expect(smallTexts(root())).toEqual([]);
    await press('game9-mark-done');
    await press('game9-count-done');
    expect(screen.getByTestId(/^game9-result-/)).toBeOnTheScreen();
    expectAccessible(root());
    expect(headers()).toHaveLength(1);
  });

  it('ExplainPlayer (lesson 1)', async () => {
    await openAt('/lesson/u01-board');
    expectAccessible(root());
    expect(uncapped(screen.getByTestId('lesson-text'), 1.3)).toEqual([]);
  });

  it.each([
    ['tap-point', 'u01-board', 0],
    ['play-move', 'u01-board', 2],
    ['choice', 'u01-board', 3],
    ['count', 'u02-liberties', 1],
    ['play-bot', 'u06-capture-go', 0],
    ['sequence', 'u09-ladder', 4],
    ['mark', 'u12-territory', 0],
  ])('runner %s (%s #%i)', async (_type, id, index) => {
    const view = render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ExerciseView lesson={lessonOf(id)} index={index} onClose={jest.fn()} onDone={jest.fn()} />
      </SafeAreaProvider>,
    );
    await settle();
    expectAccessible(view.UNSAFE_root);
    expect(uncapped(view.getByTestId('practice-feedback'), 1.3)).toEqual([]);
    view.unmount();
  });

  it('ResultView', async () => {
    const view = render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ResultView
          outcomes={SIX}
          result={{ stars: 3, previousStars: 0, unlockedUnit: 2 }}
          hasNext
          onNext={jest.fn()}
          onAgain={jest.fn()}
          onReview={jest.fn()}
          onMap={jest.fn()}
        />
      </SafeAreaProvider>,
    );
    await advance(2000);
    expectAccessible(view.UNSAFE_root);
    expect(view.getAllByRole('header')).toHaveLength(1);
    view.unmount();
  });
});

describe('exercise feedback is heard once (AC 39)', () => {
  it('a wrong tap: one announcement, and the card is not also an Android live region', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation();
    const lesson = lessonOf('u01-board');
    const view = render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ExerciseView lesson={lesson} index={2} onClose={jest.fn()} onDone={jest.fn()} />
      </SafeAreaProvider>,
    );
    await settle();
    announce.mockClear();
    // Play somewhere on the play-move board: any legal move gets feedback (right or wrong).
    const board = view.getByTestId('practice-board');
    const width = StyleSheet.flatten(board.props.style).width as number;
    const size = view.queryAllByTestId(/^board-grid-h-/, { includeHiddenElements: true }).length;
    const g = boardGeometry(size as 5 | 7 | 9, width, lesson.coordinates ?? false);
    const { x, y } = pointToLocation(g, { x: 0, y: 0 });
    const event = { nativeEvent: { locationX: x, locationY: y } };
    await act(async () => {
      fireEvent(view.getByTestId('board-touch'), 'responderGrant', event);
    });
    await act(async () => {
      fireEvent(view.getByTestId('board-touch'), 'responderRelease', event);
    });
    const feedback = view.getByTestId('practice-feedback');
    expect(feedback.props.accessibilityLabel.length).toBeGreaterThan(0);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(feedback.props.accessibilityLabel);
    expect(feedback.props.accessibilityLiveRegion).toBe('none');
    view.unmount();
  });
});
