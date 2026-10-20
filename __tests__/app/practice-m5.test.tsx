// M5 item 1 play behaviour through the real practice route (spec
// docs/specs/M5-ko-forbidden-ladders.md AC 12, 13, 26, 27, 30): prelude, ko refusal, try again.
import { act, fireEvent, screen } from 'expo-router/testing-library';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import {
  advance,
  feedbackText,
  flat,
  has,
  hidden,
  next,
  open,
  press,
  reduceMotion,
  settle,
  texts,
} from '@/exercises/__fixtures__/practiceDriver';
import { setLanguageChoice } from '@/i18n';
import { getSolution, type Lesson } from '@/lessons';
import { LESSON_FILES } from '@/lessons/registry';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const byId = (id: string) => (LESSON_FILES as readonly Lesson[]).find((l) => l.id === id)!;

beforeEach(async () => {
  jest.useFakeTimers();
  reduceMotion(true);
  progressStore.getState().reset();
  for (const id of [
    'u01-board',
    'u02-liberties',
    'u03-connection',
    'u04-capture',
    'u05-atari',
    'u06-capture-go',
    'u07-forbidden',
    'u08-ko',
    'u09-ladder',
  ]) {
    progressStore.getState().record(id, ['clean']);
  }
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Touch-down + touch-up on a vertex of a practice board drawn WITH coordinates (M5 lessons). */
async function tap(vertex: string) {
  const board = screen.getByTestId('practice-board');
  const width = flat(board.props.style).width as number;
  const size = screen.queryAllByTestId(/^board-grid-h-/, hidden).length;
  const g = boardGeometry(size as 5 | 7, width, true);
  const { x, y } = pointToLocation(g, parseVertex(vertex, size as 5 | 7));
  const target = screen.getByTestId('board-touch');
  const event = { nativeEvent: { locationX: x, locationY: y } };
  await act(async () => {
    fireEvent(target, 'responderGrant', event);
  });
  await act(async () => {
    fireEvent(target, 'responderRelease', event);
  });
}

/** Answers exercise `index` of `lessonId` correctly with the engine's solution. */
async function solve(lessonId: string, index: number) {
  const exercise = byId(lessonId).exercises[index];
  switch (exercise.type) {
    case 'tap-point':
      if (exercise.mode === 'one') return tap(getSolution(exercise).points[0]);
      for (const p of getSolution(exercise).points) await tap(p);
      return press('practice-check');
    case 'play-move':
      return tap(getSolution(exercise).points[0]);
    case 'choice':
      return press(`practice-option-${getSolution(exercise).index}`);
    case 'count':
      await press(`practice-chip-${getSolution(exercise).value}`);
      return press('practice-check');
    case 'sequence':
      // M5-sequence-v2: the learner's moves of the line, each answered after the reply delay.
      for (let k = 0; k < exercise.line.length; k += 2) {
        await tap(exercise.line[k].at);
        await advance(1000);
      }
      return;
  }
}

async function openAt(lessonId: string, index: number) {
  await open(`/practice/${lessonId}`);
  for (let i = 0; i < index; i++) {
    await solve(lessonId, i);
    await next();
  }
  expect(screen.getByText(texts[byId(lessonId).exercises[index].promptKey])).toBeOnTheScreen();
}

describe('prelude on screen (AC 12)', () => {
  it('u08 e5: the captured c4 is gone, the prelude stones stand, the last move is marked', async () => {
    await openAt('u08-ko', 4);
    expect(has('board-stone-c4')).toBe(false);
    for (const at of ['c3', 'e5', 'a5']) expect(has(`board-stone-${at}`)).toBe(true);
    expect(has('board-last-move')).toBe(true);
  });

  it('u08 e1: tapping the closed point c4 is correct', async () => {
    await openAt('u08-ko', 0);
    expect(has('board-stone-c4')).toBe(false);
    await tap('c4');
    expect(screen.getByTestId('practice-next')).toBeOnTheScreen();
  });

  it.each(['u07-forbidden', 'u08-ko', 'u09-ladder', 'u09-review'])(
    '%s: every exercise can be solved through the screen',
    async (id) => {
      await open(`/practice/${id}`);
      const count = byId(id).exercises.length;
      for (let i = 0; i < count; i++) {
        await solve(id, i);
        expect({ i, next: has('practice-next') || has('practice-finish') }).toEqual({
          i,
          next: true,
        });
        if (i < count - 1) await next();
      }
    },
  );
});

describe('ko refusal and try again (AC 13, 26)', () => {
  it('u08 e6: c4 is refused with the ko sentence, costs no try; Try again keeps the ban', async () => {
    await openAt('u08-ko', 5);
    await tap('c4');
    expect(feedbackText()).toBe(texts['engine.illegal.ko']);
    expect(has('board-stone-c4')).toBe(false);
    expect(has('practice-try-again')).toBe(false);

    // Two real mistakes: the hint opens but the answer is not revealed, so the ko tap was free.
    await tap('a1');
    expect(feedbackText()).toBe(texts['fb.pm.noAtari']);
    await press('practice-try-again');
    await settle();
    expect(has('board-stone-a1')).toBe(false);
    // AC 13: the ban is back after Try again.
    await tap('c4');
    expect(feedbackText()).toBe(texts['engine.illegal.ko']);
    await tap('a1');
    expect(has('board-highlight-hint-g6')).toBe(true);
    expect(has('practice-next')).toBe(false);
    await press('practice-try-again');
    await settle();
    await tap('g6');
    expect(has('practice-next')).toBe(true);
  });
});

describe('wrong moves (AC 27, 30)', () => {
  it('u07 e5: a legal non-capturing move says fb.pm.noCapture', async () => {
    await openAt('u07-forbidden', 4);
    await tap('a1');
    expect(feedbackText()).toBe(texts['fb.pm.noCapture']);
  });

  it('u09 e3: three mistakes reveal the answer with the explanation', async () => {
    await openAt('u09-ladder', 2);
    for (let i = 0; i < 3; i++) {
      await tap('a1');
      if (i < 2) await press('practice-try-again');
      await settle();
    }
    expect(feedbackText()).toBe(`${texts['fb.revealed']} ${texts['lesson.u09-ladder.e3.explain']}`);
    expect(has('board-highlight-success-a3')).toBe(true);
    expect(has('board-highlight-success-b4')).toBe(true);
    expect(has('practice-next')).toBe(true);
  });
});
