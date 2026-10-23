// Unit 6 Capture Go sets through the real practice route (spec docs/specs/M4-bot-capture-go.md
// AC 55, 62): the learner plays each game with the hint's own move (the "Sensible" learner).
import { act, screen } from 'expo-router/testing-library';
import { processColor } from 'react-native';

import { createGame, type Vertex } from '@/engine';
import {
  advance,
  boardSize,
  hidden,
  open,
  press,
  reduceMotion,
  settle,
  tap,
  texts,
} from '@/exercises/__fixtures__/practiceDriver';
import { BOT_DELAY_REDUCED_MS, END_BEAT_MS, suggest } from '@/exercises/botGame';
import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';
import { stone } from '@/theme/tokens';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

beforeEach(async () => {
  jest.useFakeTimers();
  reduceMotion(true);
  progressStore.getState().reset();
  // M6-settings: a returning learner, past the first-launch intro (Home is not redirected).
  progressStore.getState().setFlag('onboardingSeen');
  // Unit 6 opens after 1★ on Unit 5 (AC 59).
  for (const id of ['u01-board', 'u02-liberties', 'u03-connection', 'u04-capture', 'u05-atari']) {
    progressStore.getState().record(id, ['clean']);
  }
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** The stones on the practice board, read from the drawn stones. */
function position(): { B: Vertex[]; W: Vertex[] } {
  const black = processColor(stone.black);
  const white = processColor(stone.white);
  const setup: { B: Vertex[]; W: Vertex[] } = { B: [], W: [] };
  for (const node of screen.queryAllByTestId(/^board-stone-[a-t]\d+$/, hidden)) {
    const fill = (node.props.fill as { payload?: unknown } | undefined)?.payload;
    const at = String(node.props.testID).slice('board-stone-'.length) as Vertex;
    if (fill === black) setup.B.push(at);
    else if (fill === white) setup.W.push(at);
  }
  return setup;
}

/** Plays the current game as Black with the hint's move until the game ends. */
async function playGame() {
  for (let ply = 0; ply < 60; ply++) {
    if (screen.queryByTestId('game-win') || screen.queryByTestId('game-lose')) return;
    if (screen.queryByTestId('game-turn-bot')) {
      await advance(BOT_DELAY_REDUCED_MS);
      continue;
    }
    if (screen.queryByTestId('game-turn-you') === null) {
      await advance(END_BEAT_MS);
      continue;
    }
    const size = Math.round(Math.sqrt(boardSize())) as 5 | 7;
    const hint = suggest(createGame(size, { setup: position(), toPlay: 'B' }));
    if (!hint) throw new Error('no move for the learner');
    await tap(hint.at);
  }
  throw new Error('the game did not end');
}

describe('Unit 6 through the practice route', () => {
  it('AC 55: ✕ during a game opens the leave sheet; leaving records nothing', async () => {
    const router = await open('/practice/u06-capture-go');
    expect(screen.getByTestId('game-turn-you')).toBeOnTheScreen();
    await press('practice-close');
    expect(screen.getByText(texts['practice.leave.title'])).toBeOnTheScreen();
    await press('leave-confirm');
    await settle();
    await advance(600);
    expect(router.getPathname()).toBe('/');
    expect(progressStore.getState().lessons['u06-capture-go']).toBeUndefined();
  });

  it('AC 62: three games won on the first try → 3★ and the games summary', async () => {
    await open('/practice/u06-capture-go');
    // Fixed bot seeds for games 2 and 3 (seeded when they mount; game 1 needs no bot move). The
    // router uses Math.random too, so the spy starts after navigation.
    jest.spyOn(Math, 'random').mockReturnValue(0.25);
    for (let game = 0; game < 3; game++) {
      await playGame();
      expect(screen.getByTestId('game-win')).toBeOnTheScreen();
      await press(game < 2 ? 'game-next' : 'game-finish');
      await settle();
    }
    await advance(2000);
    expect(screen.getAllByTestId('result-star-filled')).toHaveLength(3);
    expect(
      screen.getByText(
        texts['complete.gamesFirstTry'].replace('{{n}}', '3').replace('{{total}}', '3'),
      ),
    ).toBeOnTheScreen();
    expect(progressStore.getState().lessons['u06-capture-go']?.stars).toBe(3);
  });
});
