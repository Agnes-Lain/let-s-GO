// Seeded randomness for the bot (spec docs/specs/M4-bot-capture-go.md §6.1). The only source of
// randomness in src/bot: callers inject an Rng, so every game can be replayed from its seed.

/** Returns a number in [0, 1). */
export type Rng = () => number;

/** mulberry32: a tiny, fast 32-bit generator. The same seed gives the same sequence. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed derived from a base seed and a number (e.g. the ply), so each ply has its own stream. */
export function deriveSeed(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
