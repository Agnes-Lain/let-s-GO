// Spec docs/specs/M6b-13x13-bot-tuning.md AC 5, 11: the mistake knobs per level and board size.
import {
  L1_BLUNDER_13,
  L1_BLUNDER_9,
  L1_SKIP_ATARI_13,
  L1_SKIP_ATARI_9,
  L1_SKIP_SAVE_13,
  L1_SKIP_SAVE_9,
  L2_SLIP_13,
  L2_SLIP_9,
  levelKnobs,
} from './config';

describe('levelKnobs', () => {
  it('AC 5: 9×9 keeps its values (Easy 0.6 / 0.5 / 0.5, Normal slip 0.7)', () => {
    expect([L1_BLUNDER_9, L1_SKIP_SAVE_9, L1_SKIP_ATARI_9, L2_SLIP_9]).toEqual([
      0.6, 0.5, 0.5, 0.7,
    ]);
    expect(levelKnobs(1, 9)).toEqual({ blunder: 0.6, skipSave: 0.5, skipAtari: 0.5, slip: 0 });
    expect(levelKnobs(2, 9)).toEqual({ blunder: 0, skipSave: 0, skipAtari: 0, slip: 0.7 });
    expect(levelKnobs(3, 9)).toEqual({ blunder: 0, skipSave: 0, skipAtari: 0, slip: 0 });
  });

  it('AC 11: 13×13 uses the tuned _13 values (Easy 0.3 / 0.3 / 0.3, Normal slip 0.5)', () => {
    expect([L1_BLUNDER_13, L1_SKIP_SAVE_13, L1_SKIP_ATARI_13, L2_SLIP_13]).toEqual([
      0.3, 0.3, 0.3, 0.5,
    ]);
    expect(levelKnobs(1, 13)).toEqual({ blunder: 0.3, skipSave: 0.3, skipAtari: 0.3, slip: 0 });
    expect(levelKnobs(2, 13)).toEqual({ blunder: 0, skipSave: 0, skipAtari: 0, slip: 0.5 });
    expect(levelKnobs(3, 13)).toEqual({ blunder: 0, skipSave: 0, skipAtari: 0, slip: 0 });
  });
});
