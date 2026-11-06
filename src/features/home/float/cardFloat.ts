/**
 * Floating of the cards (R5-Flottaison.txt): the category fan's five cards and the carousel's app
 * cards rise and fall on a sine (ease-in-out by nature), each with its own period (× 0.90 to
 * × 1.07) and its own start (0.6 to 0.7 s after the previous one), one card in two rocking the
 * other way: never « en bloc ». Transform only, on the app's single frame loop. Pure (tested).
 */
import {
  FLOAT_LEVELS,
  FLOAT_NAMES,
  FLOAT_RHYTHM as R,
  type FloatLevel,
  type FloatName,
} from "../../../design/motion/tokens5";

/** The level of a setting value (`categoryHover.float`), « Visible » when unknown. */
export function floatLevel(name: unknown): FloatLevel {
  return FLOAT_LEVELS[
    (FLOAT_NAMES as readonly unknown[]).includes(name) ? (name as FloatName) : "visible"
  ];
}

/** Fixed pseudo-random number in [0, 1) (same at every start). */
export function seed(i: number, k: number): number {
  const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A stable number for a string (an app id): each carousel card keeps its rhythm. */
export function seedOfKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) % 997;
}

export interface FloatSample {
  /** Sideways drift (px). */
  dx: number;
  /** Vertical offset (px, negative = up). */
  dy: number;
  /** Rocking (deg). */
  rot: number;
  /** Height above the lowest point, 0 – 1 of the full shadow change (the ground shadow). */
  elev: number;
}

const REST: FloatSample = { dx: 0, dy: 0, rot: 0, elev: 0 };

/** Start of card `i` of a row (the fan): each one 0.6 to 0.7 s after the previous one. */
export function staggerStart(i: number): number {
  let start = 0;
  for (let j = 0; j < i; j++) start += R.staggerMin + (R.staggerMax - R.staggerMin) * seed(j, 2);
  return start;
}

/**
 * Card `i` (its rank or seed: its own period and its rocking side) at time t (ms), for an
 * amplitude (px, ±), a rocking (deg, ±), a base period (ms) and its start (ms).
 */
export function floatAt(
  i: number,
  t: number,
  amp: number,
  tilt: number,
  period: number,
  start: number = staggerStart(i),
): FloatSample {
  if (amp <= 0) return REST;
  const p = period * (R.periodMin + (R.periodMax - R.periodMin) * seed(i, 1));
  const s = Math.sin((2 * Math.PI * (t - start)) / p);
  const side = i % 2 === 0 ? 1 : -1;
  const w = Math.sin((2 * Math.PI * (t - start)) / (p * R.driftPeriod) + seed(i, 3) * 6.28);
  return {
    dx: amp * R.driftShare * w,
    dy: -amp * s,
    rot: side * tilt * s,
    elev: Math.min(1, (amp * (1 + s)) / R.shadowFullAt),
  };
}
