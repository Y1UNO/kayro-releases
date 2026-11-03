import type { Box } from "./home";

/**
 * Kysland's music mode: the stage's measures, from the screen it covers. Lengths scale with the
 * screen (`U`, its smaller side), springs and durations never do. Logical pixels. Pure, tested.
 */

export interface Pt {
  x: number;
  y: number;
}

/** A small round drop (or anything drawn as a circle). */
export interface Dot extends Pt {
  r: number;
}

export interface Metrics {
  /** The stage (the screen), logical px. */
  W: number;
  H: number;
  /** Its smaller side, and that side over 960 (1 on a 1080p screen at 112 %). */
  U: number;
  S: number;
  /** The heart's radius, and the title's size. */
  R: number;
  T: number;
  /** Where the heart lives. */
  C: Pt;
  /** The top the ink never crosses: the island's edge when docked, the screen's top otherwise. */
  yTop: number;
  /** Where targets stay (away from the screen's edges). */
  safe: Box;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The measures of a stage `W` × `H` whose island sits at `homeY` (docked or floating). */
export function metricsOf(W: number, H: number, homeY: number, docked: boolean): Metrics {
  const U = Math.max(1, Math.min(W, H));
  const yTop = docked ? homeY : 0;
  return {
    W,
    H,
    U,
    S: U / 960,
    R: clamp(0.09 * U, 56, 170),
    T: clamp(0.075 * U, 44, 112),
    C: { x: W / 2, y: yTop + 0.47 * (H - yTop) },
    yTop,
    safe: { x0: 0.06 * U, y0: yTop + 0.06 * U, x1: W - 0.06 * U, y1: H - 0.1 * U },
  };
}

/** `p` kept inside `b`. */
export const keepIn = (p: Pt, b: Box): Pt => ({
  x: clamp(p.x, b.x0, b.x1),
  y: clamp(p.y, b.y0, b.y1),
});
