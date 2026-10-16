import { sampleLesson } from '@/lessons/__fixtures__/fixtures';
import type { Lesson, Outcome, UnitEntry } from '@/lessons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { progressStore } from './index';
import { createProgressStore, PROGRESS_KEY } from './progress';
import { createMemoryStorage, type StorageAdapter } from './storage';

const CODE: Record<string, Outcome> = { C: 'clean', S: 'solved', R: 'revealed' };
const run = (code: string) => [...code].map((c) => CODE[c]);
const NOW = new Date('2026-10-16T08:00:00.000Z');

function make(storage: StorageAdapter = createMemoryStorage(), units: UnitEntry[] = []) {
  return createProgressStore({ storage, units: () => units, now: () => NOW });
}

describe('record (AC 32–34)', () => {
  it('AC 32: a first 3★ run', () => {
    const store = make();
    const result = store.getState().record('u00-sample', run('CCCCCC'));
    expect(store.getState().lessons['u00-sample']).toEqual({
      stars: 3,
      plays: 1,
      bestClean: 6,
      bestSolved: 6,
      total: 6,
      lastPlayedAt: '2026-10-16T08:00:00.000Z',
    });
    expect(result).toEqual({ stars: 3, previousStars: 0, unlockedUnit: null });
  });

  it('AC 33: a worse replay keeps the best stars and counts the play', () => {
    const store = make();
    store.getState().record('u00-sample', run('CCCCCC'));
    const result = store.getState().record('u00-sample', run('CCCRRR'));
    expect(store.getState().lessons['u00-sample']).toMatchObject({
      stars: 3,
      plays: 2,
      bestClean: 6,
      bestSolved: 6,
    });
    expect(result).toEqual({ stars: 1, previousStars: 3, unlockedUnit: null });
  });

  it('AC 34: the first star on unit 1 unlocks unit 2, once', () => {
    const base = sampleLesson() as Lesson;
    const unit = (n: number): UnitEntry => ({
      unit: n,
      titleKey: `unit.${n}.title`,
      lesson: { ...base, id: `u0${n}-x`, unit: n },
      checkpoint: null,
    });
    const store = make(createMemoryStorage(), [unit(1), unit(2)]);
    expect(store.getState().record('u01-x', run('RRRRRR')).unlockedUnit).toBeNull();
    expect(store.getState().record('u01-x', run('CCCRRR')).unlockedUnit).toBe(2);
    expect(store.getState().record('u01-x', run('CCCCSS')).unlockedUnit).toBeNull();
  });
});

describe('persistence (AC 35–38)', () => {
  it('AC 35: a new store over the same storage holds the same data', () => {
    const storage = createMemoryStorage();
    make(storage).getState().record('u00-sample', run('CCCCSS'));
    const raw = storage.data.get(PROGRESS_KEY) as string;
    expect(JSON.parse(raw)).toEqual({ v: 1, lessons: { 'u00-sample': expect.any(Object) } });
    const again = make(storage);
    expect(again.getState().lessons).toEqual({
      'u00-sample': {
        stars: 2,
        plays: 1,
        bestClean: 4,
        bestSolved: 6,
        total: 6,
        lastPlayedAt: NOW.toISOString(),
      },
    });
  });

  it.each([
    ['not JSON', '{not json'],
    ['another version', JSON.stringify({ v: 2, lessons: {} })],
    ['lessons not an object', JSON.stringify({ v: 1, lessons: 3 })],
    ['lessons an array', JSON.stringify({ v: 1, lessons: [] })],
  ])('AC 36: %s → empty, no throw, value kept until the first record', (_name, bad) => {
    const storage = createMemoryStorage({ [PROGRESS_KEY]: bad });
    let store: ReturnType<typeof make> | undefined;
    expect(() => {
      store = make(storage);
    }).not.toThrow();
    expect(store?.getState().lessons).toEqual({});
    expect(storage.data.get(PROGRESS_KEY)).toBe(bad);
    store?.getState().record('u00-sample', run('CCCCCC'));
    expect(storage.data.get(PROGRESS_KEY)).not.toBe(bad);
  });

  it('drops a malformed lesson entry but keeps the others', () => {
    const good = { stars: 1, plays: 1, bestClean: 1, bestSolved: 3, total: 6, lastPlayedAt: 'x' };
    const storage = createMemoryStorage({
      [PROGRESS_KEY]: JSON.stringify({ v: 1, lessons: { a: good, b: { stars: 9 } } }),
    });
    expect(make(storage).getState().lessons).toEqual({ a: good });
  });

  it('AC 37: reset empties the store and the storage key', () => {
    const storage = createMemoryStorage();
    const store = make(storage);
    store.getState().record('u00-sample', run('CCCCCC'));
    store.getState().reset();
    expect(store.getState().lessons).toEqual({});
    expect(storage.data.has(PROGRESS_KEY)).toBe(false);
  });

  it('AC 38: a synchronous adapter hydrates at once', () => {
    expect(make().getState().hydrated).toBe(true);
  });

  it('AC 38: an async adapter is hydrated after the read resolves', async () => {
    let resolve: (value: string | null) => void = () => undefined;
    const storage: StorageAdapter = {
      getItem: () => new Promise((r) => (resolve = r)),
      setItem: jest.fn(() => Promise.resolve()),
      removeItem: () => Promise.resolve(),
    };
    const store = make(storage);
    expect(store.getState().hydrated).toBe(false);
    resolve(
      JSON.stringify({
        v: 1,
        lessons: {
          a: { stars: 2, plays: 1, bestClean: 4, bestSolved: 6, total: 6, lastPlayedAt: 'x' },
        },
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().starsOf('a')).toBe(2);
  });

  it('a run finished before hydration is merged with the saved best', async () => {
    let resolve: (value: string | null) => void = () => undefined;
    const saved = { stars: 3, plays: 4, bestClean: 6, bestSolved: 6, total: 6, lastPlayedAt: 'a' };
    const storage: StorageAdapter = {
      getItem: () => new Promise((r) => (resolve = r)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    const store = make(storage);
    store.getState().record('l', run('CCCRRR'));
    resolve(JSON.stringify({ v: 1, lessons: { l: saved } }));
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState().lessons.l).toMatchObject({ stars: 3, plays: 5, bestClean: 6 });
  });

  it('AC 38: starsOf an unknown lesson is 0', () => {
    expect(make().getState().starsOf('nope')).toBe(0);
  });

  it('a failing or throwing storage never breaks the store', async () => {
    const storage: StorageAdapter = {
      getItem: () => {
        throw new Error('boom');
      },
      setItem: () => Promise.reject(new Error('full')),
      removeItem: () => Promise.reject(new Error('nope')),
    };
    const store = make(storage);
    expect(store.getState().hydrated).toBe(true);
    expect(() => store.getState().record('a', run('CCCCC'))).not.toThrow();
    expect(() => store.getState().reset()).not.toThrow();
    await Promise.resolve();
  });
});

describe('the adapter (AC 44)', () => {
  it('the store file imports no native module', () => {
    const { readFileSync } = jest.requireActual<typeof import('node:fs')>('node:fs');
    const code = readFileSync(require.resolve('./progress'), 'utf8');
    const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(imports.filter((m) => !/^(zustand|@\/lessons|\.\/storage)/.test(m))).toEqual([]);
  });

  it('the app store saves through AsyncStorage', async () => {
    await new Promise((r) => setTimeout(r, 0));
    expect(progressStore.getState().hydrated).toBe(true);
    progressStore.getState().record('u00-sample', run('CCCCCS'));
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    expect(JSON.parse(raw as string).lessons['u00-sample'].stars).toBe(3);
    progressStore.getState().reset();
  });
});
