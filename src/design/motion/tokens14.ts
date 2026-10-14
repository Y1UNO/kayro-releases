import { curveOf, type Curve } from "./curve";
import { EASES } from "./eases";

/**
 * Game colours (step 14, decisions of the board, DA-JOURNAL 14/10). Durations at speed 1 (the
 * screens divide them by the motion speed, as the rest of the table).
 */
export const GAME_COLORS = {
  /** V8 b: the colours follow a selection once it has rested this long (ms); a burst never does. */
  delay: 180,
  /**
   * V7 c, the tide: the new colours spread in a circle from the selected card, a band of light on
   * its edge (in the spirit of the theme's wave: 0.55, full until 80 %). No View Transition: the
   * engine mixes the two palettes by the distance to the centre.
   */
  tide: { ms: 700, ease: "standard", band: 0.55, full: 0.8, bandPx: 70, softPx: 90 },
  /** V3 b: the game's blurred hero at the top of the immersive night, fading into it. */
  hero: { opacity: 0.75, fadeFrom: 0.18, fadeTo: 0.6, sharpLod: 4.5, fadeMs: 360 },
} as const;

/** Curve of the tide (CSS timing function of the table). */
export function tideCurve(): Curve {
  return curveOf(EASES[GAME_COLORS.tide.ease] ?? "linear");
}

/** How far the tide goes from (x, y) on a W × H view: the farthest corner, plus its soft edge. */
export function tideReachPx(x: number, y: number, W: number, H: number): number {
  return Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + GAME_COLORS.tide.softPx;
}

/** Radius of the tide at time `t` (ms) for a farthest corner at `reach` px. */
export function tideRadius(t: number, ms: number, reach: number): number {
  return tideCurve()(Math.min(1, Math.max(0, t / ms))) * reach;
}

/** When the tide's edge reaches `distance` px (ms): the curve inverted by bisection. */
export function tideReach(distance: number, ms: number, reach: number): number {
  if (distance <= 0 || reach <= 0) return 0;
  if (distance >= reach) return ms;
  const curve = tideCurve();
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (curve(mid) * reach < distance) lo = mid;
    else hi = mid;
  }
  return hi * ms;
}
