import type { Home } from "./home";
import { clamp } from "./motion";
import type { Part } from "./region";

/**
 * Kysland's music mode: the one family of shapes the island takes on its way out and back, a
 * rounded box whose corners round off (all round with equal sides: a ball). At home it is the
 * island exactly: docked, a square top (in a corner, its flush side square too).
 */

/** Each corner's roundness (0 square, 1 as round as the shape allows): TL, TR, BR, BL. */
export type Corners = [number, number, number, number];

/** The island's corners at home: docked, a square top (in a corner, its flush side too). */
export function homeCorners(h: Home): Corners {
  if (!h.docked) return [1, 1, 1, 1];
  if (h.corner < -0.5) return [0, 0, 1, 0];
  if (h.corner > 0.5) return [0, 0, 0, 1];
  return [0, 0, 1, 1];
}

/**
 * A rounded box centred on (x, y): half sizes `a` × `b` stretched by `sx` × `sy`, turned by
 * `rot`, each corner's radius a fraction of the smaller half size (all 1 with a = b: a circle).
 */
export function traceBall(
  ctx: CanvasRenderingContext2D | Path2D,
  x: number,
  y: number,
  a: number,
  b: number,
  c: Corners,
  sx = 1,
  sy = 1,
  rot = 0,
): void {
  const A = Math.max(0.5, a * sx);
  const B = Math.max(0.5, b * sy);
  const m = Math.min(A, B);
  const [cr, sr] = [Math.cos(rot), Math.sin(rot)];
  let first = true;
  // Clockwise (y down) from the top right: each corner's middle and where its quarter starts.
  const quarters: Array<[number, number, number, number]> = [
    [A, -B, c[1], -Math.PI / 2],
    [A, B, c[2], 0],
    [-A, B, c[3], Math.PI / 2],
    [-A, -B, c[0], Math.PI],
  ];
  for (const [qx, qy, f, a0] of quarters) {
    const r = clamp(f, 0, 1) * m;
    const ox = qx - Math.sign(qx) * r;
    const oy = qy - Math.sign(qy) * r;
    const n = r < 0.5 ? 1 : clamp(Math.ceil(r / 6), 4, 24);
    for (let k = 0; k <= n; k++) {
      const t = a0 + (k / n) * (Math.PI / 2);
      const px = ox + Math.cos(t) * r;
      const py = oy + Math.sin(t) * r;
      const X = x + px * cr - py * sr;
      const Y = y + px * sr + py * cr;
      if (first) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
      first = false;
    }
  }
  ctx.closePath();
}

/** A ball's box as drawn (its longest half size and a little), with its speed (the region). */
export const ballPart = (
  x: number,
  y: number,
  A: number,
  B: number,
  vx: number,
  vy: number,
): Part => {
  const r = Math.max(A, B) + 4;
  return { x0: x - r, y0: y - r, x1: x + r, y1: y + r, vx, vy };
};
