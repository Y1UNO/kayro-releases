/** Stable pseudo-random numbers in [0, 1) (same as the mock-ups: stable layout, no Math.random). */
export function hash(i: number, k: number, m: number): number {
  return Math.abs(Math.sin(i * k) * m) % 1;
}
