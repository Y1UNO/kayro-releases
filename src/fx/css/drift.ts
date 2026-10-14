/**
 * Slow continuous motion (moon, veils, ring reflection), computed from a clock instead of CSS
 * `infinite` animations: the frame loop can then cap it (see budget.ts, `maxFps`). Pure.
 */

const ease = (t: number) => t * t * (3 - 2 * t);

/** 0 → 1 → 0 over `periodMs`, ease-in-out on each half (a CSS `ease-in-out` there-and-back). */
export function pingPong(timeMs: number, periodMs: number): number {
  const p = (timeMs % periodMs) / periodMs;
  return ease(p < 0.5 ? p * 2 : (1 - p) * 2);
}
