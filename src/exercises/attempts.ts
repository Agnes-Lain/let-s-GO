// Attempt policy (spec §5.1): 1st wrong → reason; 2nd wrong → reason + hint; 3rd wrong → answer
// shown. A choice allows min(3, options − 1) wrong taps. Pure, so it is easy to test.
import type { Exercise, Outcome } from '@/lessons';

/** A sentence of feedback: an i18n key and its parameters. */
export interface FeedbackLine {
  key: string;
  params?: Record<string, string | number>;
}

export type AttemptStatus = 'active' | 'correct' | 'revealed';

export interface AttemptState {
  status: AttemptStatus;
  wrong: number;
  /** The learner pressed *Hint* (no `clean` afterwards). */
  hintUsed: boolean;
  /** The hint text and pulse are showing. */
  hintOpen: boolean;
  /** Reason for the last wrong attempt (or an illegal-move note), until cleared. */
  message: FeedbackLine[] | null;
}

export type AttemptAction =
  | { type: 'wrong'; lines: FeedbackLine[] }
  | { type: 'correct' }
  | { type: 'hint' }
  /** A note that is not an attempt (illegal move). */
  | { type: 'info'; lines: FeedbackLine[] }
  | { type: 'clear' };

export const INITIAL_ATTEMPTS: AttemptState = {
  status: 'active',
  wrong: 0,
  hintUsed: false,
  hintOpen: false,
  message: null,
};

/** Wrong attempts before the answer is shown. */
export function maxWrongAttempts(exercise: Exercise): number {
  return exercise.type === 'choice' ? Math.min(3, exercise.options.length - 1) : 3;
}

export function hasHint(exercise: Exercise): boolean {
  return exercise.hintKey !== undefined;
}

export function attemptsReducer(exercise: Exercise) {
  return (state: AttemptState, action: AttemptAction): AttemptState => {
    if (state.status !== 'active') return state;
    switch (action.type) {
      case 'correct':
        return { ...state, status: 'correct', message: null };
      case 'wrong': {
        const wrong = state.wrong + 1;
        if (wrong >= maxWrongAttempts(exercise)) {
          return { ...state, wrong, status: 'revealed', message: null, hintOpen: false };
        }
        const hintOpen = state.hintOpen || (wrong >= 2 && hasHint(exercise));
        return { ...state, wrong, hintOpen, message: action.lines };
      }
      case 'hint':
        if (!hasHint(exercise) || state.hintOpen) return state;
        return { ...state, hintUsed: true, hintOpen: true };
      case 'info':
        return { ...state, message: action.lines };
      case 'clear':
        return state.message ? { ...state, message: null } : state;
    }
  };
}

/** The outcome of a finished exercise. */
export function outcomeOf(state: AttemptState): Outcome {
  if (state.status === 'revealed') return 'revealed';
  return state.wrong === 0 && !state.hintUsed ? 'clean' : 'solved';
}
