// M3 exercise runners and result screen (spec §6.3–6.6, ACs 59–95) on the sample lesson.
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { router as appRouter } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import { boardGeometry, pointToLocation } from '@/board';
import { playStoneSound } from '@/board/sound';
import { parseVertex } from '@/engine';
import {
  advance,
  boardSize,
  feedbackText,
  flat,
  goTo,
  has,
  hidden,
  next,
  open,
  press,
  reduceMotion,
  settle,
  solve,
  tap,
  texts,
} from '@/exercises/__fixtures__/practiceDriver';
import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

beforeEach(async () => {
  jest.useFakeTimers();
  reduceMotion(true);
  progressStore.getState().reset();
  (playStoneSound as jest.Mock).mockClear();
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('shell (AC 59–67)', () => {
  it('AC 59: 6 segments, prompt 1, 5×5 board, Hint, empty feedback, no primary button', async () => {
    await open();
    expect(screen.getAllByTestId(/^segment-/)).toHaveLength(6);
    expect(screen.getByTestId('segment-current')).toBeTruthy();
    expect(screen.getByTestId('practice-progress').props.accessibilityLabel).toBe(
      'Exercise 1 of 6',
    );
    expect(screen.getByText(texts['lesson.u00-sample.e1.prompt'])).toBeOnTheScreen();
    expect(boardSize()).toBe(25);
    expect(screen.getByRole('button', { name: 'Hint' })).toBeOnTheScreen();
    expect(feedbackText()).toBe('');
    expect(screen.queryByTestId('practice-next')).toBeNull();
    expect(screen.queryByTestId('practice-check')).toBeNull();
  });

  it('AC 60: Next only after a correct answer; the last one reads Finish', async () => {
    await open();
    await solve(0);
    expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen();
    await next();
    expect(screen.getByText(texts['lesson.u00-sample.e2.prompt'])).toBeOnTheScreen();
    for (let i = 1; i < 5; i++) {
      await solve(i);
      await next();
    }
    expect(screen.getByText(texts['lesson.u00-sample.e6.prompt'])).toBeOnTheScreen();
    await solve(5);
    expect(screen.getByRole('button', { name: 'Finish' })).toBeOnTheScreen();
  });

  it('AC 61: the hint shows text + pulse on c4 once; the answer is then solved', async () => {
    await open();
    await press('practice-hint');
    expect(feedbackText()).toBe(texts['lesson.u00-sample.e1.hint']);
    expect(has('practice-feedback-hint')).toBe(true);
    expect(has('board-highlight-hint-c4')).toBe(true);
    await press('practice-hint');
    expect(feedbackText()).toBe(texts['lesson.u00-sample.e1.hint']);
    await solve(0);
    await next();
    for (let i = 1; i < 6; i++) {
      await solve(i);
      await next();
    }
    // 5 clean + 1 solved (the hinted one) is still 3★ but bestClean is 5.
    expect(progressStore.getState().lessons['u00-sample']).toMatchObject({
      bestClean: 5,
      bestSolved: 6,
    });
  });

  it('AC 62–63: c3 three times on e3 → message, hint, reveal; e3 itself is not an attempt', async () => {
    await open();
    await goTo(2);
    await tap('e3');
    expect(feedbackText()).toBe(texts['engine.illegal.occupied']);
    expect(has('board-stone-e3')).toBe(true);

    await tap('c3');
    expect(feedbackText()).toBe(texts['fb.pm.noCapture']);
    expect(has('board-highlight-hint-d3')).toBe(false);
    await press('practice-try-again');
    await tap('c3');
    expect(feedbackText()).toBe(
      `${texts['fb.pm.noCapture']} ${texts['lesson.u00-sample.e3.hint']}`,
    );
    expect(has('board-highlight-hint-d3')).toBe(true);
    await press('practice-try-again');
    await tap('c3');
    // AC 79: reset to the setup, success ring on d3, revealed + explain, Next.
    expect(feedbackText()).toBe(`${texts['fb.revealed']} ${texts['lesson.u00-sample.e3.explain']}`);
    expect(has('board-highlight-success-d3')).toBe(true);
    expect(has('board-stone-c3')).toBe(false);
    expect(has('board-stone-d3')).toBe(false);
    expect(screen.getByTestId('practice-next')).toBeTruthy();
  });

  it('AC 64: a correct answer locks the board and shows Correct! + explain', async () => {
    await open();
    await goTo(2);
    await solve(2);
    expect(feedbackText()).toBe(`${texts['fb.correct']} ${texts['lesson.u00-sample.e3.explain']}`);
    expect(has('practice-feedback-success')).toBe(true);
    await tap('a1');
    expect(has('board-stone-a1')).toBe(false);
  });

  it('AC 65: ✕ opens the leave sheet; Keep going stays, Leave goes home and records nothing', async () => {
    const router = await open();
    await press('practice-close');
    expect(screen.getByText(texts['practice.leave.title'])).toBeOnTheScreen();
    await press('leave-stay');
    expect(screen.queryByText(texts['practice.leave.title'])).toBeNull();
    expect(router.getPathname()).toBe('/practice/u00-sample');
    await press('practice-close');
    await press('leave-confirm');
    await settle();
    expect(router.getPathname()).toBe('/');
    expect(progressStore.getState().lessons).toEqual({});
  });

  it('AC 65: the back gesture / hardware back also opens the sheet', async () => {
    const router = await open();
    await act(() => appRouter.back());
    await settle();
    expect(router.getPathname()).toBe('/practice/u00-sample');
    expect(screen.getByText(texts['practice.leave.title'])).toBeOnTheScreen();
  });

  it('AC 66: Finish records the six outcomes once and shows the result', async () => {
    await open();
    const plays = () => progressStore.getState().lessons['u00-sample']?.plays ?? 0;
    await goTo(5);
    await solve(5);
    expect(plays()).toBe(0);
    await next();
    expect(plays()).toBe(1);
    expect(progressStore.getState().lessons['u00-sample']).toMatchObject({
      stars: 3,
      bestClean: 6,
      total: 6,
    });
    await settle();
    await advance(1000);
    expect(plays()).toBe(1);
    expect(screen.getByText(texts['complete.title.3'])).toBeOnTheScreen();
  });

  it('AC 67: the feedback card is always 72 px high', async () => {
    await open();
    expect(flat(screen.getByTestId('practice-feedback').props.style).height).toBe(72);
    await tap('c3');
    expect(flat(screen.getByTestId('practice-feedback').props.style).height).toBe(72);
  });
});

describe('tap-point (AC 68–71)', () => {
  it('AC 68: a ring preview on touch-down; occupied c3 is a wrong tap', async () => {
    await open();
    const board = screen.getByTestId('practice-board');
    const g = boardGeometry(5, flat(board.props.style).width as number, false);
    const c4 = pointToLocation(g, parseVertex('c4', 5));
    await act(async () => {
      fireEvent(screen.getByTestId('board-touch'), 'responderGrant', {
        nativeEvent: { locationX: c4.x, locationY: c4.y },
      });
    });
    expect(has('board-pointer-ring')).toBe(true);
    expect(has('board-ghost')).toBe(false);
    await tap('c3');
    expect(feedbackText()).toBe(texts['fb.tapOne.wrong']);
    await tap('c4');
    expect(feedbackText()).toBe(texts['fb.correct']);
  });

  it('AC 69: toggle points, Check disabled until something is selected', async () => {
    await open();
    await goTo(1);
    expect(screen.getByTestId('practice-check').props.accessibilityState.disabled).toBe(true);
    await tap('b1');
    expect(has('board-highlight-liberty-b1')).toBe(true);
    expect(screen.getByTestId('practice-check').props.accessibilityState.disabled).toBe(false);
    await tap('b1');
    expect(has('board-highlight-liberty-b1')).toBe(false);
    await solve(1);
    expect(feedbackText()).toBe(texts['fb.correct']);
  });

  it('AC 70: b1 + c3 → 1 of 3 found, c3 flashes red and is removed, b1 stays', async () => {
    await open();
    await goTo(1);
    await tap('b1');
    await tap('c3');
    await press('practice-check');
    expect(feedbackText()).toBe(
      `${texts['fb.tapAll.partial'].replace('{{found}}', '1').replace('{{total}}', '3')} ${texts['fb.tapAll.extra']}`,
    );
    expect(has('board-highlight-error-c3')).toBe(true);
    expect(has('board-highlight-liberty-b1')).toBe(true);
    expect(has('board-highlight-liberty-c3')).toBe(false);
    await advance(700);
    expect(has('board-highlight-error-c3')).toBe(false);
  });

  it('AC 71: three wrong checks reveal b1, d1, c2', async () => {
    await open();
    await goTo(1);
    for (let i = 0; i < 3; i++) {
      await tap('a5');
      await press('practice-check');
    }
    expect(feedbackText()).toBe(texts['fb.revealed']);
    for (const v of ['b1', 'd1', 'c2']) expect(has(`board-highlight-success-${v}`)).toBe(true);
  });
});

describe('play-move (AC 72–73, 75)', () => {
  it('AC 72: d3 captures with sound and the capture fade', async () => {
    reduceMotion(false);
    await open();
    await goTo(2);
    (playStoneSound as jest.Mock).mockClear();
    await tap('d3');
    expect(has('board-stone-d3')).toBe(true);
    expect(has('board-stone-e3')).toBe(false);
    expect(has('board-capture-e3')).toBe(true);
    expect(playStoneSound).toHaveBeenCalled();
    expect(feedbackText()).toContain(texts['fb.correct']);
  });

  it('AC 73: c3 → error ring, locked, Try again restores the setup', async () => {
    await open();
    await goTo(2);
    await tap('c3');
    expect(has('board-highlight-error-c3')).toBe(true);
    await tap('d3');
    expect(has('board-stone-d3')).toBe(false); // locked
    await press('practice-try-again');
    expect(has('board-stone-c3')).toBe(false);
    for (const v of ['e4', 'e2', 'e3']) expect(has(`board-stone-${v}`)).toBe(true);
    await tap('d3');
    expect(has('board-stone-d3')).toBe(true);
  });

  it('AC 75: connect — b4 is wrong, c4 is occupied (not counted), c3 connects', async () => {
    await open();
    await goTo(3);
    await tap('c4');
    expect(feedbackText()).toBe(texts['engine.illegal.occupied']);
    await tap('b4');
    expect(feedbackText()).toBe(texts['fb.pm.notConnected']);
    await press('practice-try-again');
    await tap('c3');
    expect(feedbackText()).toBe(texts['fb.correct']);
  });
});

describe('choice (AC 80–82)', () => {
  it('AC 80: options in order, ≥ 48 px; option 3 is correct', async () => {
    await open();
    await goTo(4);
    const options = [0, 1, 2].map((i) => screen.getByTestId(`practice-option-${i}`));
    expect(options.map((o) => o.props.accessibilityLabel)).toEqual([
      texts['lesson.u00-sample.e5.o1'],
      texts['lesson.u00-sample.e5.o2'],
      texts['lesson.u00-sample.e5.o3'],
    ]);
    for (const o of options) expect(flat(o.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(has('board-marker-label-c4')).toBe(true);
    expect(has('board-touch')).toBe(false); // AC 84: display-only
    await press('practice-option-2');
    expect(feedbackText()).toBe(`${texts['fb.correct']} ${texts['lesson.u00-sample.e5.explain']}`);
  });

  it('AC 81: a wrong option greys out with its why text', async () => {
    await open();
    await goTo(4);
    await press('practice-option-0');
    expect(feedbackText()).toBe(texts['lesson.u00-sample.e5.w1']);
    expect(screen.getByTestId('practice-option-0').props.accessibilityState.disabled).toBe(true);
    await press('practice-option-2');
    expect(feedbackText()).toContain(texts['fb.correct']);
  });

  it('AC 82: two wrong options reveal the answer', async () => {
    await open();
    await goTo(4);
    await press('practice-option-0');
    await press('practice-option-1');
    expect(feedbackText()).toContain(texts['fb.revealed']);
    expect(screen.getByTestId('practice-option-2').props.accessibilityState.selected).toBe(true);
  });
});

describe('count (AC 85–87)', () => {
  it('AC 85: chips 0–9, Check disabled until a chip is chosen; 5 is right', async () => {
    await open();
    await goTo(5);
    for (let n = 0; n <= 9; n++) expect(screen.getByTestId(`practice-chip-${n}`)).toBeTruthy();
    expect(screen.getByTestId('practice-check').props.accessibilityState.disabled).toBe(true);
    await solve(5);
    expect(feedbackText()).toBe(texts['fb.correct']);
  });

  it('AC 86: a wrong number keeps the chip; another chip clears the message', async () => {
    await open();
    await goTo(5);
    await press('practice-chip-4');
    await press('practice-check');
    expect(feedbackText()).toBe(texts['fb.count.wrong']);
    expect(screen.getByTestId('practice-chip-4').props.accessibilityState.selected).toBe(true);
    await press('practice-chip-3');
    expect(feedbackText()).toBe('');
  });

  it('AC 87: hint after the 2nd wrong; after the 3rd the 5 liberties are ringed', async () => {
    await open();
    await goTo(5);
    await press('practice-chip-4');
    await press('practice-check');
    await press('practice-check');
    expect(feedbackText()).toContain(texts['lesson.u00-sample.e6.hint']);
    await press('practice-check');
    for (const v of ['d3', 'c4', 'e5', 'e3', 'f4']) {
      expect(has(`board-highlight-success-${v}`)).toBe(true);
    }
    expect(screen.getByTestId('practice-chip-5').props.accessibilityState.disabled).toBe(true);
    expect(feedbackText()).toContain(texts['fb.revealed']);
  });
});

describe('result screen (AC 89–95)', () => {
  /** Plays the set: 'C' = clean, 'S' = hint then solve, 'R' = reveal. (e5 has no hint.) */
  async function playSet(code: string) {
    for (let i = 0; i < code.length; i++) {
      if (code[i] === 'S') await press('practice-hint');
      if (code[i] === 'R') await reveal(i);
      else await solve(i);
      await next();
    }
  }
  async function reveal(index: number) {
    switch (index) {
      case 0:
        for (let k = 0; k < 3; k++) await tap('a1');
        return;
      case 1:
        for (let k = 0; k < 3; k++) {
          await tap('a5');
          await press('practice-check');
        }
        return;
      case 2:
      case 3:
        for (let k = 0; k < 3; k++) {
          await tap('a1');
          if (k < 2) await press('practice-try-again');
        }
        return;
      case 4:
        await press('practice-option-0');
        return press('practice-option-1');
      case 5:
        await press('practice-chip-1');
        for (let k = 0; k < 3; k++) await press('practice-check');
    }
  }

  it('AC 89: CCCCCC → 3 stars, title, summary, Back to map, store 3★', async () => {
    await open();
    await playSet('CCCCCC');
    expect(screen.getAllByTestId('result-star-filled', hidden)).toHaveLength(3);
    expect(screen.getByText(texts['complete.title.3'])).toBeOnTheScreen();
    expect(screen.getByText('6 of 6 right the first time')).toBeOnTheScreen();
    expect(screen.getByTestId('result-map')).toBeTruthy();
    expect(screen.queryByTestId('result-next')).toBeNull();
    expect(progressStore.getState().starsOf('u00-sample')).toBe(3);
  });

  it('AC 90: stars appear 250 ms apart with a tock each', async () => {
    reduceMotion(false);
    await open();
    await playSet('CCCCCC');
    (playStoneSound as jest.Mock).mockClear();
    expect(screen.queryAllByTestId('result-star-filled', hidden)).toHaveLength(0);
    await advance(250);
    expect(screen.getAllByTestId('result-star-filled', hidden)).toHaveLength(1);
    await advance(500);
    expect(screen.getAllByTestId('result-star-filled', hidden)).toHaveLength(3);
    expect(playStoneSound).toHaveBeenCalledTimes(3);
  });

  it('AC 91: CCCCSS → 2★; CSRRRR → 0★ layout with Review and Try again', async () => {
    const router = await open();
    await playSet('SSCCCC');
    expect(screen.getAllByTestId('result-star-filled', hidden)).toHaveLength(2);
    expect(screen.getByText('4 of 6 right the first time')).toBeOnTheScreen();
    await press('result-again');
    await playSet('CSRRRR');
    expect(screen.queryAllByTestId('result-star-filled', hidden)).toHaveLength(0);
    expect(screen.getByText(texts['complete.title.0'])).toBeOnTheScreen();
    expect(
      screen.getByText('You solved 2 of 6 on your own. A look back at the lesson will help.'),
    ).toBeOnTheScreen();
    // AC 93: this run is below the best (2★).
    expect(screen.getByText('Best: 2 of 3 stars')).toBeOnTheScreen();
    await press('result-again');
    expect(screen.getByTestId('practice-progress').props.accessibilityLabel).toBe(
      'Exercise 1 of 6',
    );
    await playSet('CSRRRR');
    await press('result-review');
    await settle();
    expect(router.getPathname()).toBe('/lesson/u00-sample');
  });

  it('AC 91: CCCSRR → 1★', async () => {
    await open();
    await playSet('CCCSRR'); // S on e4 (connect, has a hint)
    expect(screen.getAllByTestId('result-star-filled', hidden)).toHaveLength(1);
    expect(screen.getByText(texts['complete.title.1'])).toBeOnTheScreen();
  });

  it('AC 94: the stars are announced once as one element', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    await open();
    await playSet('CCCCCC');
    const calls = announce.mock.calls.filter(([text]) => String(text).includes('3 of 3 stars'));
    expect(calls).toHaveLength(1);
    expect(screen.getByTestId('result-stars').props.accessibilityLabel).toBe('3 of 3 stars');
  });

  it('AC 95: Practice again records a fresh run only once more', async () => {
    await open();
    const plays = () => progressStore.getState().lessons['u00-sample']?.plays ?? 0;
    await playSet('CCCCCC');
    await press('result-again');
    expect(plays()).toBe(1);
    await playSet('CCCCCC');
    expect(plays()).toBe(2);
  });
});
