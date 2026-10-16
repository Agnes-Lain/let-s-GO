import { sampleLesson } from '@/lessons/__fixtures__/fixtures';
import type { Exercise } from '@/lessons';

import {
  INITIAL_ATTEMPTS,
  attemptsReducer,
  maxWrongAttempts,
  outcomeOf,
  type AttemptAction,
  type AttemptState,
} from './attempts';

const exercises = sampleLesson().exercises as Exercise[];
const why = [{ key: 'fb.pm.noCapture' }];

function run(exercise: Exercise, actions: AttemptAction[]): AttemptState {
  return actions.reduce(attemptsReducer(exercise), INITIAL_ATTEMPTS);
}

describe('attempt policy (§5.1, AC 61–62)', () => {
  const e3 = exercises[2];

  it('first try → clean', () => {
    const state = run(e3, [{ type: 'correct' }]);
    expect(state.status).toBe('correct');
    expect(outcomeOf(state)).toBe('clean');
  });

  it('AC 61: after the hint, a correct answer is solved', () => {
    const state = run(e3, [{ type: 'hint' }, { type: 'correct' }]);
    expect(state.hintUsed).toBe(true);
    expect(outcomeOf(state)).toBe('solved');
  });

  it('AC 62: wrong #1 → message; #2 → message + hint; #3 → revealed', () => {
    const one = run(e3, [{ type: 'wrong', lines: why }]);
    expect(one).toMatchObject({ status: 'active', wrong: 1, hintOpen: false, message: why });
    const two = run(e3, [
      { type: 'wrong', lines: why },
      { type: 'wrong', lines: why },
    ]);
    expect(two).toMatchObject({ status: 'active', wrong: 2, hintOpen: true, hintUsed: false });
    const three = run(e3, [
      { type: 'wrong', lines: why },
      { type: 'wrong', lines: why },
      { type: 'wrong', lines: why },
    ]);
    expect(three.status).toBe('revealed');
    expect(outcomeOf(three)).toBe('revealed');
  });

  it('a wrong attempt then a correct one is solved', () => {
    expect(outcomeOf(run(e3, [{ type: 'wrong', lines: why }, { type: 'correct' }]))).toBe('solved');
  });

  it('info (illegal move) and clear never count as attempts', () => {
    const state = run(e3, [{ type: 'info', lines: why }, { type: 'clear' }, { type: 'correct' }]);
    expect(outcomeOf(state)).toBe('clean');
  });

  it('the hint opens once; nothing changes after the exercise ended', () => {
    const state = run(e3, [{ type: 'hint' }, { type: 'hint' }]);
    expect(state).toMatchObject({ hintOpen: true, hintUsed: true });
    const done = run(e3, [{ type: 'correct' }, { type: 'wrong', lines: why }, { type: 'hint' }]);
    expect(done).toMatchObject({ status: 'correct', wrong: 0, hintUsed: false });
  });

  it('no hint key → the hint never opens', () => {
    const e5 = exercises[4];
    expect(run(e5, [{ type: 'hint' }]).hintOpen).toBe(false);
  });

  it('AC 82–83: a choice allows min(3, options − 1) wrong taps', () => {
    const e5 = exercises[4];
    expect(maxWrongAttempts(e5)).toBe(2);
    expect(run(e5, [{ type: 'wrong', lines: why }]).status).toBe('active');
    expect(
      run(e5, [
        { type: 'wrong', lines: why },
        { type: 'wrong', lines: why },
      ]).status,
    ).toBe('revealed');
    const two = { ...e5, options: e5.type === 'choice' ? e5.options.slice(1) : [] } as Exercise;
    expect(maxWrongAttempts(two)).toBe(1);
    expect(run(two, [{ type: 'wrong', lines: why }]).status).toBe('revealed');
    expect(maxWrongAttempts(exercises[0])).toBe(3);
  });
});
