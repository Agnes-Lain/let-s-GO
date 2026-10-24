// App-wide layout rule (spec docs/specs/M5-life-death.md §5.6, AC 39, 41, 44): instructions on
// top, board in the middle, feedback / options / actions at the bottom. Jest has no real layout,
// so the order is the render order of a column (top to bottom).
import { act, screen } from 'expo-router/testing-library';
import { router as appRouter } from 'expo-router';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  goTo,
  open,
  reduceMotion,
  settle,
  solve,
  next,
} from '@/exercises/__fixtures__/practiceDriver';
import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/lessons/registry', () =>
  jest.requireActual('@/lessons/__fixtures__/sampleRegistry').registryWithSample(),
);
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

beforeEach(async () => {
  jest.useFakeTimers();
  reduceMotion(true);
  progressStore.getState().reset();
  // M6-settings: a returning learner, past the first-launch intro.
  progressStore.getState().setFlag('onboardingSeen');
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** testIDs in render order. */
function order(): string[] {
  const ids: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const n = node as { props?: { testID?: string }; children?: unknown[] };
    if (n.props?.testID) ids.push(n.props.testID);
    (n.children ?? []).forEach(walk);
  };
  walk(screen.toJSON());
  return ids;
}
const before = (ids: string[], a: string, b: string) => {
  const i = ids.indexOf(a);
  const j = ids.indexOf(b);
  return i >= 0 && j >= 0 && i < j;
};

describe('AC 39: explanation steps read text first, then the board', () => {
  it('text card above the board area, Replay below the board, Next at the bottom', async () => {
    await open('/');
    await act(() => appRouter.push('/lesson/u00-sample'));
    await settle();
    const ids = order();
    expect(before(ids, 'lesson-text-card', 'lesson-board-area')).toBe(true);
    expect(before(ids, 'lesson-board-area', 'lesson-next')).toBe(true);
    if (ids.includes('lesson-replay')) {
      expect(before(ids, 'lesson-board-area', 'lesson-replay')).toBe(true);
    }
  });
});

describe('AC 41: every exercise type reads prompt → board → feedback', () => {
  // u00-sample: tap-point, tap-point, play-move, play-move, choice, count.
  it.each([
    [0, 'tap-point'],
    [2, 'play-move'],
    [4, 'choice'],
    [5, 'count'],
  ])('exercise %i (%s)', async (index) => {
    await open();
    await goTo(index);
    const ids = order();
    expect(before(ids, 'practice-prompt', 'practice-board')).toBe(true);
    expect(before(ids, 'practice-board', 'practice-feedback')).toBe(true);
    if (ids.some((id) => id.startsWith('practice-option-'))) {
      const option = ids.find((id) => id.startsWith('practice-option-'))!;
      expect(before(ids, 'practice-board', option)).toBe(true);
    }
    await solve(index);
    await next();
  });
});

describe('AC 44: no instruction text between the board and the bottom buttons', () => {
  // Source check: the runners only render the feedback card, options, chips and buttons below
  // the board; instruction texts come from promptKey / textKey cards above it.
  const root = join(__dirname, '..', '..');
  it.each([
    'src/exercises/runners/TapPointRunner.tsx',
    'src/exercises/runners/PlayMoveRunner.tsx',
    'src/exercises/runners/ChoiceRunner.tsx',
    'src/exercises/runners/CountRunner.tsx',
    'src/exercises/runners/SequenceRunner.tsx',
    'src/exercises/runners/PlayBotRunner.tsx',
    'src/exercises/ExplainPlayer.tsx',
  ])('%s uses promptKey / textKey only above the board', (file) => {
    const code = readFileSync(join(root, file), 'utf8');
    const board = code.indexOf('<GoBoard');
    const after = code.slice(board);
    expect(board).toBeGreaterThan(0);
    // Answer options (option.textKey) and the feedback card are allowed below the board.
    expect(after).not.toMatch(/promptKey|step\.textKey/);
  });
});
