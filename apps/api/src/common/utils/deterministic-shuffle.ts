/**
 * Deterministic, seedable shuffle utilities.
 *
 * Used to give every student a per-attempt permutation of question order and
 * MCQ option order (anti-cheating) WITHOUT persisting the arrangement: because
 * the shuffle is seeded by the immutable attemptId, the same order is produced
 * on every resume, across all api replicas, with zero extra DB writes.
 *
 * IMPORTANT: this only randomizes presentation order. Option identity (the
 * stable option `id`) is never changed, so grading (which matches on option id)
 * is unaffected.
 */

// xmur3 string hash -> 32-bit seed.
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

// mulberry32 PRNG.
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a new array shuffled deterministically from the given seed.
 * The same (items.length, seed) always yields the same permutation.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rngSeed = xmur3(seed)();
  const rand = mulberry32(rngSeed);
  const arr = [...items];
  // Fisher-Yates with the seeded PRNG.
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
