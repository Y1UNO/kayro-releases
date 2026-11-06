/**
 * Draws the hand of handPose.ts on a 2D canvas (no WebGL): the 21 points turned in 3D, seen in
 * perspective, the palm as a plate, each bone a shaded capsule (far ones first), and at the
 * contact a glow of the cursor's own colours (glow.rs: blue for the left click, amber for the
 * right).
 */

import type { HandFrame, V3 } from "./handPose";

/** How the hand is seen: turned around its height (yaw) and tipped (pitch), radians. */
export interface Look {
  yaw: number;
  pitch: number;
  /** A turn of the hand in its own plane first (rad; a thumb up lays the fist down). */
  roll?: number;
}

/** A direction of the hand as `look` turns it: rolled, turned (yaw), then tipped (pitch). */
export function turnView([x, y, z]: V3, look: Look): V3 {
  const cr = Math.cos(look.roll ?? 0);
  const sr = Math.sin(look.roll ?? 0);
  const x0 = x * cr - y * sr;
  const y0 = x * sr + y * cr;
  const cy = Math.cos(look.yaw);
  const sy = Math.sin(look.yaw);
  const x1 = x0 * cy + z * sy;
  const z1 = -x0 * sy + z * cy;
  const cp = Math.cos(look.pitch);
  const sp = Math.sin(look.pitch);
  return [x1, y0 * cp - z1 * sp, y0 * sp + z1 * cp];
}

/** The bones drawn as capsules: [from, to, radius at `from` (cm), radius at `to`]. */
const BONES: [number, number, number, number][] = [
  [1, 2, 1.15, 1.0],
  [2, 3, 1.0, 0.9],
  [3, 4, 0.9, 0.8],
  [5, 6, 0.9, 0.8],
  [6, 7, 0.8, 0.72],
  [7, 8, 0.72, 0.66],
  [9, 10, 0.95, 0.85],
  [10, 11, 0.85, 0.75],
  [11, 12, 0.75, 0.68],
  [13, 14, 0.88, 0.8],
  [14, 15, 0.8, 0.72],
  [15, 16, 0.72, 0.65],
  [17, 18, 0.78, 0.7],
  [18, 19, 0.7, 0.62],
  [19, 20, 0.62, 0.56],
];
/** The palm's outline: a wrist corner, the thumb's root, the four knuckles, the other corner. */
const PALM: (number | V3)[] = [[2.0, 0, -0.3], 1, 5, 9, 13, 17, [-2.6, 0.4, -0.3]];
/** The point the view turns around (the palm's middle, cm). */
const CENTRE: V3 = [0, 7.5, 1.5];
/** The eye's distance (cm). */
const EYE = 42;

const GLOW = {
  left: "122, 178, 255",
  right: "255, 190, 120",
} as const;

interface P2 {
  x: number;
  y: number;
  z: number;
  s: number;
}

function project(p: V3, look: Look, w: number, h: number, size: number): P2 {
  const [x1, y2, z2] = turnView([p[0] - CENTRE[0], p[1] - CENTRE[1], p[2] - CENTRE[2]], look);
  const s = (size * EYE) / (EYE - z2);
  return { x: w / 2 + x1 * s, y: h * 0.52 - y2 * s, z: z2, s };
}

/** A capsule from `a` to `b` (radii in pixels), shaded across its width. */
function capsule(ctx: CanvasRenderingContext2D, a: P2, b: P2, ra: number, rb: number, lit: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1e-3;
  const nx = -dy / len;
  const ny = dx / len;
  const an = Math.atan2(ny, nx);
  ctx.beginPath();
  ctx.moveTo(a.x + nx * ra, a.y + ny * ra);
  ctx.lineTo(b.x + nx * rb, b.y + ny * rb);
  ctx.arc(b.x, b.y, rb, an, an + Math.PI, true);
  ctx.lineTo(a.x - nx * ra, a.y - ny * ra);
  ctx.arc(a.x, a.y, ra, an + Math.PI, an, true);
  ctx.closePath();
  const r = Math.max(ra, rb);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const g = ctx.createLinearGradient(mx - nx * r, my - ny * r, mx + nx * r, my + ny * r);
  const tone = (k: number) => Math.round(Math.min(255, k * lit));
  g.addColorStop(0, `rgb(${tone(120)}, ${tone(126)}, ${tone(140)})`);
  g.addColorStop(0.55, `rgb(${tone(214)}, ${tone(220)}, ${tone(232)})`);
  g.addColorStop(1, `rgb(${tone(246)}, ${tone(248)}, ${tone(252)})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.stroke();
}

/** One frame of the hand on a canvas `w` × `h` (CSS pixels, the context already scaled). */
export function drawHand(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: HandFrame,
  look: Look,
) {
  ctx.clearRect(0, 0, w, h);
  const size = (h * 0.8) / 20;
  const pts = frame.joints.map((p) => project(p, look, w, h, size));
  const none: P2 = { x: w / 2, y: h / 2, z: 0, s: size };
  const at = (i: number): P2 => pts[i] ?? none;
  const zs = pts.map((p) => p.z);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  // Nearer is lighter (0.78–1.0).
  const lit = (z: number) => 0.78 + (0.22 * (z - zMin)) / Math.max(1e-3, zMax - zMin);

  // The palm: a plate under the bones.
  const palm = PALM.map((q) => (typeof q === "number" ? at(q) : project(q, look, w, h, size)));
  ctx.beginPath();
  palm.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  const top = at(9);
  const g = ctx.createLinearGradient(at(0).x, at(0).y, top.x, top.y);
  g.addColorStop(0, "rgb(150, 156, 170)");
  g.addColorStop(1, "rgb(205, 211, 224)");
  ctx.fillStyle = g;
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.9 * at(5).s;
  ctx.strokeStyle = "rgb(180, 186, 199)";
  ctx.stroke();
  ctx.fill();

  // The bones, far ones first.
  const order = BONES.map((bone) => ({ bone, z: (at(bone[0]).z + at(bone[1]).z) / 2 })).sort(
    (a, b) => a.z - b.z,
  );
  for (const { bone } of order) {
    const [from, to, ra, rb] = bone;
    const a = at(from);
    const b = at(to);
    capsule(ctx, a, b, ra * a.s, rb * b.s, lit((a.z + b.z) / 2));
  }

  // The contact: the cursor's glow.
  if (frame.contact > 0 && frame.phase !== "open") {
    const tip = at(frame.touched);
    const thumb = at(4);
    const x = (tip.x + thumb.x) / 2;
    const y = (tip.y + thumb.y) / 2;
    const r = 2.6 * tip.s;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = GLOW[frame.phase];
    glow.addColorStop(0, `rgba(${c}, ${0.75 * frame.contact})`);
    glow.addColorStop(1, `rgba(${c}, 0)`);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.globalCompositeOperation = "source-over";
  }
}
