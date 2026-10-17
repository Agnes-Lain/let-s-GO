import { createRng } from './rng';

describe('createRng (AC 3)', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('gives different sequences for seeds 1 and 2', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(Array.from({ length: 5 }, () => a())).not.toEqual(Array.from({ length: 5 }, () => b()));
  });

  it('stays in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10000; i++) {
      const r = rng();
      expect(r >= 0 && r < 1).toBe(true);
    }
  });

  it('is roughly uniform', () => {
    const rng = createRng(3);
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) buckets[Math.floor(rng() * 4)]++;
    for (const b of buckets) expect(Math.abs(b - 1000)).toBeLessThan(120);
  });
});
