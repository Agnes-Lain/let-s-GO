// Spec docs/specs/M6b-13x13-game.md AC 1, 14–17: 13×13 results in `bots13` (separate from 9×9)
// with old saves loading unchanged. The size comes from the route since §13 (PO 2026-10-25): an old
// save's `flags.gameSize` (M6b first draft) is ignored on load.
import { createProgressStore, parseSaved, PROGRESS_KEY, serializeProgress } from './progress';
import { createMemoryStorage, type StorageAdapter } from './storage';

const NOW = new Date('2026-10-24T08:00:00.000Z');

function make(storage: StorageAdapter = createMemoryStorage()) {
  return createProgressStore({ storage, now: () => NOW });
}

describe('AC 14–16: 13×13 results are stored apart from 9×9', () => {
  it('a 13×13 loss steps the 13×13 suggestion up and leaves bots untouched', () => {
    const store = make();
    store.getState().recordGame(2, 'win', 4);
    const bots = store.getState().bots;
    store.getState().recordGame(2, 'loss', 5, 13);
    expect(store.getState().bots).toBe(bots);
    expect(store.getState().bots13).toEqual({
      '2': { games: 1, wins: 0, lossStreak: 1, handicap: 5 },
    });
  });

  it('AC 15: a 13×13 win is a win in bots13 (the "Beaten" badge)', () => {
    const store = make();
    store.getState().recordGame(3, 'win', 0, 13);
    expect(store.getState().bots13['3']).toEqual({
      games: 1,
      wins: 1,
      lossStreak: 0,
      handicap: 0,
      firstWinAt: NOW.toISOString(),
    });
    expect(store.getState().bots).toEqual({});
  });

  it('AC 16: a 9×9 result leaves bots13 untouched', () => {
    const store = make();
    store.getState().recordGame(1, 'resigned', 3, 13);
    const bots13 = store.getState().bots13;
    store.getState().recordGame(1, 'win', 2);
    expect(store.getState().bots13).toBe(bots13);
  });

  it('bots13 survives a reload', () => {
    const storage = createMemoryStorage();
    make(storage).getState().recordGame(2, 'loss', 5, 13);
    expect(make(storage).getState().bots13['2']).toMatchObject({ games: 1, handicap: 5 });
  });

  it('Erase progress forgets bots13', () => {
    const store = make();
    store.getState().recordGame(2, 'loss', 5, 13);
    store.getState().reset({ keepFlags: ['onboardingSeen'] });
    expect(store.getState().bots13).toEqual({});
  });
});

describe('§13: no remembered size', () => {
  it('an old save with flags.gameSize loads; the size flag is dropped, the rest kept', () => {
    const raw = JSON.stringify({ v: 1, lessons: {}, flags: { gameSize: 13, passExplained: true } });
    expect(parseSaved(raw)?.flags).toEqual({ passExplained: true });
  });
});

describe('AC 17: migration of an old save without bots13', () => {
  const OLD = JSON.stringify({
    v: 1,
    lessons: {},
    bots: { '1': { games: 4, wins: 1, lossStreak: 0, handicap: 2 } },
    flags: { passExplained: true },
  });

  it('loads with an empty bots13 and keeps every 9×9 record', () => {
    const storage = createMemoryStorage();
    storage.setItem(PROGRESS_KEY, OLD);
    const state = make(storage).getState();
    expect(state.bots13).toEqual({});
    expect(state.bots).toEqual({ '1': { games: 4, wins: 1, lossStreak: 0, handicap: 2 } });
    expect(state.flags).toEqual({ passExplained: true });
  });

  it('a broken bots13 entry is dropped, the rest kept', () => {
    const raw = JSON.stringify({
      v: 1,
      lessons: {},
      bots13: { '1': { games: 'x' }, '2': { games: 1, wins: 1, lossStreak: 0 } },
    });
    expect(parseSaved(raw)?.bots13).toEqual({ '2': { games: 1, wins: 1, lossStreak: 0 } });
  });

  it('serializes bots13 only when it has records (old shape otherwise)', () => {
    expect(JSON.parse(serializeProgress({}, {}, {}))).toEqual({ v: 1, lessons: {} });
    const rec = { games: 1, wins: 0, lossStreak: 1 };
    expect(JSON.parse(serializeProgress({}, {}, {}, { '3': rec }))).toEqual({
      v: 1,
      lessons: {},
      bots13: { '3': rec },
    });
  });

  it('a 13×13 game finished before the save loaded is merged, not lost', async () => {
    let release: (raw: string | null) => void = () => undefined;
    const storage: StorageAdapter = {
      getItem: () =>
        new Promise<string | null>((resolve) => {
          release = resolve;
        }),
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const store = make(storage);
    store.getState().recordGame(2, 'win', 3, 13);
    release(
      JSON.stringify({
        v: 1,
        lessons: {},
        bots13: { '2': { games: 2, wins: 0, lossStreak: 2, handicap: 5 } },
      }),
    );
    await Promise.resolve();
    expect(store.getState().bots13['2']).toEqual({
      games: 3,
      wins: 1,
      lossStreak: 0,
      handicap: 3,
      firstWinAt: NOW.toISOString(),
    });
  });
});
