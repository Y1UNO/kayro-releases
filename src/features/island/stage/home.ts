import { DOCKED } from "../islandShape";

/**
 * Kysland's music mode: the island at home exactly as the page draws it (Island.module.css), so
 * the drop can end on it pixel for pixel before the real island takes its place. Docked in the
 * middle: a notch, its top flush with the screen's edge, its bottom rounded (radius h/2), and
 * two concave shoulders of 10 px curving it into the bezel. Docked in a corner: flush with that
 * side too (square bottom corner there, the shoulder along the side). Floating: a capsule.
 * Its size and shoulders may be given (the springs of a landing). Logical px. Pure, tested.
 */

/** The shoulders' radius (Island.module.css `--shoulder`). */
export const SHOULDER = 10;
/** Docked, the outline the ring follows goes this far into the bezel (no seam at its edge). */
export const LIFT = 3;

export interface Home {
  /** The anchor: the middle of the island's place on its top edge. */
  x: number;
  y: number;
  w: number;
  h: number;
  docked: boolean;
  /** Docked in a corner: -1 left, 1 right, 0 the middle. */
  corner: number;
}

/** A size and shoulders for the island (its own: `w`, `h`, `SHOULDER`). */
export interface Dims {
  w: number;
  h: number;
  s: number;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const dimsOf = (h: Home): Dims => ({ w: h.w, h: h.h, s: h.docked ? SHOULDER : 0 });

const left = (h: Home) => h.docked && h.corner < -0.5;
const right = (h: Home) => h.docked && h.corner > 0.5;

/** The island's box at home (without its shoulders); in a corner, it stays flush with its side. */
export function homeBox(h: Home, d: Dims = dimsOf(h)): Box {
  const shift = h.docked ? -h.corner * ((d.w - DOCKED.width) / 2) : 0;
  const cx = h.x + shift;
  return { x0: cx - d.w / 2, y0: h.y, x1: cx + d.w / 2, y1: h.y + d.h };
}

/** Its middle (where the drop aims when it comes home). */
export function homeCentre(h: Home, d: Dims = dimsOf(h)): { x: number; y: number } {
  const b = homeBox(h, d);
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
}

/** The box with its shoulders (what the region must hold). */
export function homeBounds(h: Home, d: Dims = dimsOf(h)): Box {
  const b = homeBox(h, d);
  if (!h.docked) return b;
  return { x0: b.x0 - d.s, y0: b.y0 - LIFT, x1: b.x1 + d.s, y1: b.y1 + d.s };
}

/** Traces the island's outline at home (one closed path, clockwise), shoulders included. */
export function traceHome(
  ctx: CanvasRenderingContext2D | Path2D,
  h: Home,
  d: Dims = dimsOf(h),
): void {
  const { x0, y0, x1, y1 } = homeBox(h, d);
  const r = Math.max(0, Math.min(x1 - x0, y1 - y0) / 2);
  if (!h.docked) {
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x1, y0, x1, y1, r);
    ctx.arcTo(x1, y1, x0, y1, r);
    ctx.arcTo(x0, y1, x0, y0, r);
    ctx.arcTo(x0, y0, x1, y0, r);
    ctx.closePath();
    return;
  }
  const s = Math.max(0, d.s);
  const [l, rt] = [left(h), right(h)];
  ctx.moveTo(l ? x0 : x0 - s, y0);
  ctx.lineTo(rt ? x1 : x1 + s, y0);
  if (rt) {
    ctx.lineTo(x1, y1 + s);
    if (s > 0) ctx.arc(x1 - s, y1 + s, s, 0, -Math.PI / 2, true);
  } else {
    if (s > 0) ctx.arc(x1 + s, y0 + s, s, -Math.PI / 2, -Math.PI, true);
    ctx.lineTo(x1, y1 - r);
    ctx.arc(x1 - r, y1 - r, r, 0, Math.PI / 2);
  }
  if (l) {
    ctx.lineTo(x0 + s, y1);
    if (s > 0) ctx.arc(x0 + s, y1 + s, s, -Math.PI / 2, -Math.PI, true);
    ctx.lineTo(x0, y0);
  } else {
    ctx.lineTo(x0 + r, y1);
    ctx.arc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(x0, y0 + s);
    if (s > 0) ctx.arc(x0 - s, y0 + s, s, 0, -Math.PI / 2, true);
  }
  ctx.closePath();
}

/** How the island looks floating (its rim's tone and strength), and the canvas's scale. */
export interface HomeLook {
  tone: string;
  rimA: number;
  dpr: number;
}

/**
 * Paints the island exactly as the page draws it (the first and the last frame of a show):
 * black; floating, with its shadow and rim. `lookOnly`: only its shadow and rim.
 */
export function paintHome(
  ctx: CanvasRenderingContext2D,
  h: Home,
  look: HomeLook,
  alpha = 1,
  lookOnly = false,
): void {
  if (alpha <= 0 || (lookOnly && h.docked)) return;
  const path = new Path2D();
  traceHome(path, h);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#000";
  if (!h.docked) {
    // A canvas's shadows are in its own pixels.
    ctx.shadowColor = "rgb(0 0 0 / 0.45)";
    ctx.shadowBlur = 10 * look.dpr;
    ctx.shadowOffsetY = 4 * look.dpr;
  }
  if (lookOnly) {
    // The shape far off the canvas, its shadow cast back where it is.
    const far = 100000;
    ctx.shadowOffsetX = far * look.dpr;
    ctx.translate(-far, 0);
    ctx.fill(path);
    ctx.translate(far, 0);
    ctx.shadowOffsetX = 0;
  } else ctx.fill(path);
  if (!h.docked) {
    ctx.shadowColor = "transparent";
    ctx.clip(path);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgb(${look.tone} / ${(look.rimA * 0.7).toFixed(3)})`;
    ctx.stroke(path);
  }
  ctx.restore();
}

/** A dense polyline (world), and for each point whether it lies on the top line or a flush side. */
export interface Poly {
  xs: number[];
  ys: number[];
}

/** Adds an arc from `a0` to `a1` (radians, either way), a point at least every 2 px, 5 at least. */
function arc(p: Poly, cx: number, cy: number, r: number, a0: number, a1: number): void {
  if (r <= 0) return;
  const steps = Math.max(5, Math.ceil((Math.abs(a1 - a0) * r) / 2));
  for (let k = 1; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    p.xs.push(cx + Math.cos(a) * r);
    p.ys.push(cy + Math.sin(a) * r);
  }
}

const to = (p: Poly, x: number, y: number) => {
  p.xs.push(x);
  p.ys.push(y);
};

/**
 * The island's outline at home as a dense polyline, clockwise from its right middle (where a
 * ring's point 0 is). Docked, its top (and a flush side) go `LIFT` px into the bezel, so a ring
 * drawn into it shows no seam along the edge.
 */
export function outline(h: Home, d: Dims = dimsOf(h)): Poly {
  const { x0, y0, x1, y1 } = homeBox(h, d);
  const r = Math.max(0, Math.min(x1 - x0, y1 - y0) / 2);
  const ym = (y0 + y1) / 2;
  const s = Math.max(0, d.s);
  const p: Poly = { xs: [], ys: [] };
  const up = y0 - LIFT;
  if (!h.docked) {
    to(p, x1, ym);
    to(p, x1, y1 - r);
    arc(p, x1 - r, y1 - r, r, 0, Math.PI / 2);
    to(p, x0 + r, y1);
    arc(p, x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
    to(p, x0, y0 + r);
    arc(p, x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI);
    to(p, x1 - r, y0);
    arc(p, x1 - r, y0 + r, r, -Math.PI / 2, 0);
    return p;
  }
  if (right(h)) {
    to(p, x1 + LIFT, ym);
    to(p, x1 + LIFT, y1 + s);
    to(p, x1, y1 + s);
    arc(p, x1 - s, y1 + s, s, 0, -Math.PI / 2);
  } else {
    to(p, x1, ym);
    to(p, x1, y1 - r);
    arc(p, x1 - r, y1 - r, r, 0, Math.PI / 2);
  }
  if (left(h)) {
    to(p, x0 + s, y1);
    arc(p, x0 + s, y1 + s, s, -Math.PI / 2, -Math.PI);
    to(p, x0 - LIFT, y1 + s);
    to(p, x0 - LIFT, up);
  } else {
    to(p, x0 + r, y1);
    arc(p, x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
    to(p, x0, y0 + s);
    arc(p, x0 - s, y0 + s, s, 0, -Math.PI / 2);
    to(p, x0 - s, up);
  }
  if (right(h)) {
    to(p, x1 + LIFT, up);
  } else {
    to(p, x1 + s, up);
    to(p, x1 + s, y0);
    arc(p, x1 + s, y0 + s, s, -Math.PI / 2, -Math.PI);
  }
  return p;
}

/** `n` points along a closed polyline, evenly by length, from its first point. */
export function sample(p: Poly, n: number): Poly {
  const m = p.xs.length;
  const len: number[] = [0];
  for (let i = 1; i <= m; i++) {
    const a = (i - 1) % m;
    const b = i % m;
    len.push(len[i - 1]! + Math.hypot(p.xs[b]! - p.xs[a]!, p.ys[b]! - p.ys[a]!));
  }
  const total = len[m]!;
  const out: Poly = { xs: [], ys: [] };
  let k = 0;
  for (let i = 0; i < n; i++) {
    const at = (total * i) / n;
    while (k < m - 1 && len[k + 1]! < at) k++;
    const span = len[k + 1]! - len[k]! || 1;
    const t = (at - len[k]!) / span;
    const a = k % m;
    const b = (k + 1) % m;
    out.xs.push(p.xs[a]! + (p.xs[b]! - p.xs[a]!) * t);
    out.ys.push(p.ys[a]! + (p.ys[b]! - p.ys[a]!) * t);
  }
  return out;
}

/** Which of `n` sampled points are on the top line (docked) or the flush side (the bezel). */
export function wetMask(
  h: Home,
  pts: Poly,
  d: Dims = dimsOf(h),
): { top: Uint8Array; side: Uint8Array } {
  const n = pts.xs.length;
  const top = new Uint8Array(n);
  const side = new Uint8Array(n);
  if (!h.docked) return { top, side };
  const { x0, y0, x1 } = homeBox(h, d);
  for (let i = 0; i < n; i++) {
    if (pts.ys[i]! <= y0 + 0.5) top[i] = 1;
    if (left(h) && pts.xs[i]! <= x0 + 0.5) side[i] = 1;
    if (right(h) && pts.xs[i]! >= x1 - 0.5) side[i] = 1;
  }
  return { top, side };
}
