import { hash } from "../hash";

/**
 * Motion of the liquid ring (art direction `liquidRing`): pure functions of the time, so the ring
 * needs no state and the same moment always looks the same.
 */

/** Two slow incommensurate waves: the speed varies and sometimes reverses. */
const W1 = (2 * Math.PI) / 47_000;
const W2 = (2 * Math.PI) / 83_000;
const BASE = 0.6;
const A1 = 1;
const A2 = 0.55;

/**
 * Angle (rad) of the highlights after `t` ms at an average of `speed` turns per minute: the
 * integral of speed × (BASE + A1 sin(W1 t) + A2 sin(W2 t + 1.3)), which changes sign now and then.
 */
export function ringPhase(t: number, speed: number): number {
  const k = (2 * Math.PI * speed) / 60_000 / BASE;
  return (
    k *
    (BASE * t +
      (A1 * (1 - Math.cos(W1 * t))) / W1 +
      (A2 * (Math.cos(1.3) - Math.cos(W2 * t + 1.3))) / W2)
  );
}

/** Duration of one drop: swells, stretches, almost detaches, melts back. */
export const DROP_MS = 7_000;

/**
 * The drop under way at time `t` (ms) for `rate` drops per minute, or null. Time is cut into
 * slots of 60 000 / rate ms; each slot holds one drop at a pseudo-random moment and angle.
 */
export function dropAt(t: number, rate: number): { angle: number; progress: number } | null {
  if (rate <= 0 || t < 0) return null;
  const slot = 60_000 / rate;
  const k = Math.floor(t / slot);
  const free = Math.max(0, slot - DROP_MS);
  const start = k * slot + hash(k + 1, 12.9898, 43758.5453) * free;
  const progress = (t - start) / Math.min(DROP_MS, slot);
  if (progress < 0 || progress > 1) return null;
  return { angle: hash(k + 1, 78.233, 24634.6345) * 2 * Math.PI, progress };
}
