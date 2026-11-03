/**
 * Kysland's music mode: the small tools every scene moves with. A value on a spring (stepped
 * semi-implicitly: stable for the short steps the engine gives), easings, an angle constant.
 */

export const TAU = Math.PI * 2;

/** A value and its speed. */
export interface Sv {
  x: number;
  v: number;
}

export const sv = (x: number): Sv => ({ x, v: 0 });

/** Moves `o` towards `to` on a spring of stiffness `k` and damping ratio `z`, for `dt` s. */
export function spring(o: Sv, to: number, k: number, z: number, dt: number): void {
  const c = 2 * z * Math.sqrt(k);
  o.v += ((to - o.x) * k - o.v * c) * dt;
  o.x += o.v * dt;
}

/** Near enough and slow enough. */
export const still = (o: Sv, to: number, eps: number): boolean =>
  Math.abs(o.x - to) < eps && Math.abs(o.v) < eps * 12;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Ease in and out (cubic). */
export const eio = (u: number): number => {
  const x = clamp(u, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

/** 0 at `a`, 1 at `b` (either order), smooth. */
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a || 1), 0, 1);
  return t * t * (3 - 2 * t);
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
