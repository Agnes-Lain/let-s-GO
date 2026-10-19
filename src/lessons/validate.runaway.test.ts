// AC 32: BOT_RUNAWAY — a playout that throws or runs past maxMoves. Neither happens with the real
// bot, so the bot's playout is mocked here.
import { allTexts } from './__fixtures__/fixtures';
import { validateLesson } from './validate';

const mockPlayout = jest.fn();
jest.mock('@/bot', () => ({
  ...jest.requireActual('@/bot'),
  referencePlayout: (...args: unknown[]) => mockPlayout(...args),
}));

const lesson = {
  schema: 1,
  id: 'u06-test',
  unit: 6,
  kind: 'checkpoint',
  titleKey: 't',
  exercises: ['a', 'b'].map((id) => ({
    id,
    type: 'play-bot',
    size: 5,
    setup: { B: ['c3', 'd2'], W: ['d3', 'c2'] },
    win: { kind: 'captureN', n: 1 },
    bot: { level: 1 },
    promptKey: 'p',
  })),
};

function codes() {
  const result = validateLesson(lesson, allTexts);
  return result.ok ? [] : result.errors.map((e) => e.code);
}

describe('BOT_RUNAWAY (AC 32, 35)', () => {
  it('a playout that throws', () => {
    mockPlayout.mockImplementation(() => {
      throw new Error('illegal move: ko');
    });
    expect(codes()).toEqual(['BOT_RUNAWAY', 'BOT_RUNAWAY']);
  });

  it('a playout longer than maxMoves', () => {
    mockPlayout.mockImplementation(() => ({ status: 'won', plies: 51, state: {} }));
    expect(codes()).toEqual(['BOT_RUNAWAY', 'BOT_RUNAWAY']);
  });
});
