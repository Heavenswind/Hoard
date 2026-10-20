export type Rng = () => number;

/** Seeded PRNG (mulberry32): fast, and the same seed always gives the same run. Returns floats in [0, 1). */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [min, max]. */
export function randInt(next: Rng, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1));
}
