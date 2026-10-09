/**
 * Slow continuous motion of the CSS layer (mock-up keyframes), computed from a clock instead of
 * CSS `infinite` animations: the frame loop can then cap it (see budget.ts, `maxFps`).
 * Pure functions, no allocation per call apart from the returned string.
 */

const ease = (t: number) => t * t * (3 - 2 * t);

/** 0 → 1 → 0 over `periodMs`, ease-in-out on each half (a CSS `ease-in-out` there-and-back). */
export function pingPong(timeMs: number, periodMs: number): number {
  const p = (timeMs % periodMs) / periodMs;
  return ease(p < 0.5 ? p * 2 : (1 - p) * 2);
}

interface Pose {
  x: number;
  y: number;
  s: number;
}

/** A fog oval: start and middle poses (translate in % of the oval), period in ms. */
export interface Drift {
  from: Pose;
  to: Pose;
  period: number;
}

/** Mock-up fogA / fogB / fogC (26, 32, 38 s); 220 px of a 1000 px oval = 22 %. */
export const FOG_DRIFTS: readonly [Drift, Drift, Drift] = [
  { from: { x: 0, y: 0, s: 1 }, to: { x: 22, y: -9.5, s: 1.15 }, period: 26_000 },
  { from: { x: 0, y: 0, s: 1.08 }, to: { x: -24, y: 10, s: 0.94 }, period: 32_000 },
  { from: { x: 0, y: 0, s: 1 }, to: { x: 21, y: -18.75, s: 1.2 }, period: 38_000 },
];

export function fogTransform(d: Drift, timeMs: number): string {
  const u = pingPong(timeMs, d.period);
  const x = d.from.x + (d.to.x - d.from.x) * u;
  const y = d.from.y + (d.to.y - d.from.y) * u;
  const s = d.from.s + (d.to.s - d.from.s) * u;
  return `translate(${x.toFixed(3)}%, ${y.toFixed(3)}%) scale(${s.toFixed(4)})`;
}

/** Mock-up `sway`: −3° → 3° → −3° over 12 s. */
export const SWAY_PERIOD = 12_000;
export const SWAY_DEG = 3;

export function swayTransform(timeMs: number): string {
  const deg = -SWAY_DEG + 2 * SWAY_DEG * pingPong(timeMs, SWAY_PERIOD);
  return `rotate(${deg.toFixed(3)}deg)`;
}
