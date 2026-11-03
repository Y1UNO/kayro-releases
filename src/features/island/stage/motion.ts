/**
 * Kysland's music mode (the lab, 2026-11-03): the small tools every part moves with. A value on
 * a damped spring stepped semi-implicitly (`v += ((target − x)·k − v·2z√k)·h; x += v·h`, always
 * in steps of 1/480 s: the same motion at any screen rate), and a few helpers.
 */

export const TAU = Math.PI * 2;
export const GOLD = Math.PI * (3 - Math.sqrt(5));
/** The physics step (s). */
export const STEP = 1 / 480;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** A number in [a, b) from `random` (Math.random by default). */
export const rnd = (a = 0, b = 1, random: () => number = Math.random): number =>
  a + random() * (b - a);

/** A value and its speed, pulled towards a target by a damped spring. */
export class Sp {
  v = 0;
  constructor(public x = 0) {}

  /** Moves towards `t` on a spring of stiffness `k` and damping ratio `z`, for `h` s. */
  to(t: number, k: number, z: number, h: number): number {
    const c = 2 * z * Math.sqrt(k);
    this.v += ((t - this.x) * k - this.v * c) * h;
    this.x += this.v * h;
    return this.x;
  }

  set(x: number): void {
    this.x = x;
    this.v = 0;
  }
}

/** A box (logical px). */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const union = (a: Box, b: Box): Box => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
});

export const around = (x: number, y: number, r: number): Box => ({
  x0: x - r,
  y0: y - r,
  x1: x + r,
  y1: y + r,
});
