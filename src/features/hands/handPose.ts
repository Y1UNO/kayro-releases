/**
 * The hand of the tutorial (Réglages › Mains, step 22): a right hand in 3D as the webcam's model
 * sees it (21 points: the wrist, then thumb, index, middle, ring and pinky from base to tip), in
 * centimetres, the palm towards the viewer (+z), the fingers up (+y), the thumb on +x.
 *
 * Its bones are those of the hand model it moves (model/right.glb, the W3C's generic hand,
 * measured once: knuckles, phalanges, the thumb's metacarpal), so the model is never stretched:
 * - a finger bends at its knuckle and its middle joint, the last joint follows the middle one
 *   (two thirds of it: they are tied in a real finger), and bent fingers close in a little;
 * - the thumb is a metacarpal (inside the palm, under its mound) then two phalanges, placed by a
 *   two-bone solver so its pad meets the finger's pad;
 * - the fingers that do not pinch stay up (the user's pinches, his photos of 2026-11-05).
 * Each joint also has its bend axis (`lat`): the renderer turns the model's bones with it.
 */

export type V3 = [number, number, number];
export type RightFinger = "ring" | "middle";
export type Phase = "open" | "left" | "right";
/** Which finger meets the thumb. */
export type Pinch = "index" | RightFinger;

/** The 21 points and, for each, the axis its bone bends round (both in the hand's frame). */
export interface Skeleton {
  joints: V3[];
  lat: V3[];
}

export interface HandFrame extends Skeleton {
  phase: Phase;
  /** 0–1: how much the fingers touch (the glow at the contact). */
  contact: number;
  /** The joint the thumb touches (8: index tip, 12: middle, 16: ring). */
  touched: number;
}

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a: V3) => Math.sqrt(dot(a, a));
export const norm = (a: V3): V3 => scale(a, 1 / (len(a) || 1));
const mix = (a: V3, b: V3, k: number): V3 => add(scale(a, 1 - k), scale(b, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

type Finger = "index" | "middle" | "ring" | "pinky";
const FINGERS: Finger[] = ["index", "middle", "ring", "pinky"];
/** The knuckles (the model's proximal joints, cm). */
const BASE: Record<Finger, V3> = {
  index: [2.355, 8.855, 0.732],
  middle: [0.173, 9.165, 0.254],
  ring: [-1.747, 8.469, 0.653],
  pinky: [-3.505, 7.39, 1.369],
};
/** The three phalanges (the model's, cm; the tip joint is the pad's middle). */
const LENGTH: Record<Finger, [number, number, number]> = {
  index: [4.534, 2.431, 1.158],
  middle: [4.689, 2.755, 1.22],
  ring: [4.287, 2.658, 1.193],
  pinky: [3.458, 2.031, 1.192],
};
/** Spread (rad, towards the thumb): open (the model's rest, fanned a little), and fully bent. */
const SPREAD: Record<Finger, number> = { index: 0.08, middle: -0.06, ring: -0.24, pinky: -0.33 };
const CONVERGE: Record<Finger, number> = { index: -0.02, middle: 0, ring: 0.05, pinky: 0.12 };

/** A finger's bend (rad): at the knuckle, at the middle joint; the last joint follows. */
type Bend = [number, number];
type Bends = Record<Finger, Bend>;

/** At rest a hand is never flat (the model's own rest: each finger a little more bent). */
const OPEN: Bends = {
  index: [0.07, 0.1],
  middle: [0.1, 0.12],
  ring: [0.1, 0.15],
  pinky: [0.13, 0.18],
};
const PINCH: Record<Pinch, Bends> = {
  index: { index: [0.66, 1.0], middle: [0.14, 0.2], ring: [0.17, 0.24], pinky: [0.22, 0.28] },
  middle: { index: [0.08, 0.12], middle: [0.74, 1.05], ring: [0.24, 0.3], pinky: [0.26, 0.32] },
  ring: { index: [0.08, 0.12], middle: [0.16, 0.22], ring: [0.84, 1.1], pinky: [0.42, 0.5] },
};
/** A fist: the knuckles bent a right angle, the fingers rolled into the palm. */
const FIST: Bends = {
  index: [1.35, 1.75],
  middle: [1.4, 1.8],
  ring: [1.4, 1.8],
  pinky: [1.35, 1.75],
};
const TIP: Record<Pinch, number> = { index: 8, middle: 12, ring: 16 };

interface Chain {
  pts: V3[];
  lat: V3;
  /** The side of the tip's pad (towards the palm). */
  pad: V3;
}

/** A finger's four points (knuckle to tip), bent towards the palm side (+z). */
function finger(f: Finger, [mcp, pip]: Bend): Chain {
  const s = lerp(SPREAD[f], CONVERGE[f], clamp01(mcp / 1.4));
  const pts: V3[] = [BASE[f]];
  let at = BASE[f];
  let bend = 0;
  [mcp, pip, pip * 0.66].forEach((a, k) => {
    bend += a;
    const d: V3 = [Math.sin(s) * Math.cos(bend), Math.cos(s) * Math.cos(bend), Math.sin(bend)];
    at = add(at, scale(d, LENGTH[f][k] ?? 0));
    pts.push(at);
  });
  const pad: V3 = [-Math.sin(s) * Math.sin(bend), -Math.cos(s) * Math.sin(bend), Math.cos(bend)];
  return { pts, lat: [Math.cos(s), -Math.sin(s), 0], pad };
}

/** The thumb: its root (the base of its metacarpal), its three bones (the model's, cm). */
const THUMB_ROOT: V3 = [2.803, 3.596, 1.916];
const THUMB: [number, number, number] = [3.251, 3.378, 1.487];
/** The metacarpal's way at rest, and its tip at rest (the model's open thumb). */
const META_OPEN = norm([1.693, 2.326, 1.515]);
const OPEN_TIP: V3 = [7.79, 9.168, 4.891];
/** The way the thumb's joint juts as it bends (its back: behind, a little out and up). */
export const THUMB_POLE = norm([0.35, 0.3, -0.85]);
/** How far the thumb's tip sits from the finger's tip, pad against pad (cm). */
const PADS = 1.25;

/** Two bones of lengths l1, l2 from `a` reaching for `t`, the joint jutting towards `pole`. */
function reach(a: V3, t: V3, l1: number, l2: number, pole: V3): [V3, V3] {
  const d = sub(t, a);
  const dir = norm(d);
  const far = Math.min(len(d), (l1 + l2) * 0.999);
  const x = (l1 * l1 - l2 * l2 + far * far) / (2 * far);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const side = norm(sub(pole, scale(dir, dot(pole, dir))));
  return [add(add(a, scale(dir, x)), scale(side, h)), add(a, scale(dir, far))];
}

/** The thumb's four points with its tip at `tip`: the metacarpal turns towards it as much as
 * needed (opposition) for the two phalanges to reach. */
function thumb(tip: V3, meta: V3): V3[] {
  const [l0, l1, l2] = THUMB;
  let way = meta;
  for (let k = 0; k <= 10; k++) {
    way = norm(mix(meta, norm(sub(tip, THUMB_ROOT)), k / 10));
    if (len(sub(tip, add(THUMB_ROOT, scale(way, l0)))) <= (l1 + l2) * 0.98) break;
  }
  const mcp = add(THUMB_ROOT, scale(way, l0));
  const [ip, end] = reach(mcp, tip, l1, l2, THUMB_POLE);
  return [THUMB_ROOT, mcp, ip, end];
}

/** A thumb up: the thumb stretched out on the index's side (the tutorial lays the fist down a
 * quarter turn, so it points up, as in a real thumb up). */
const META_UP = norm([0.75, 0.55, 0.36]);
const UP_TIP = add(add(THUMB_ROOT, scale(META_UP, THUMB[0])), scale(norm([0.96, 0.22, 0.14]), 4.8));

const mixBends = (a: Bends, b: Bends, w: number): Bends => {
  const out = {} as Bends;
  for (const f of FINGERS) out[f] = [lerp(a[f][0], b[f][0], w), lerp(a[f][1], b[f][1], w)];
  return out;
};

/** The thumb's bend axis along each of its bones. */
const thumbLat = (pts: V3[]): V3[] =>
  pts.map((p, i) => {
    const next = pts[Math.min(i + 1, 3)] ?? p;
    const from = i === 3 ? (pts[2] ?? p) : p;
    return norm(cross(norm(sub(next, from)), THUMB_POLE));
  });

function assemble(bends: Bends, thumbTip: V3, meta: V3): Skeleton {
  const t = thumb(thumbTip, meta);
  const joints: V3[] = [[0, 0, 0], ...t];
  const lat: V3[] = [[1, 0, 0], ...thumbLat(t)];
  for (const f of FINGERS) {
    const c = finger(f, bends[f]);
    joints.push(...c.pts);
    lat.push(c.lat, c.lat, c.lat, c.lat);
  }
  return { joints, lat };
}

/** The hand bent `w` (0–1) of the way from open to the pinch of `which`. */
export function pose(which: Pinch, w: number): Skeleton {
  const bends = mixBends(OPEN, PINCH[which], w);
  // The thumb aims, on the way, at the finger's pad as it is now: they meet exactly at w = 1.
  const c = finger(which, bends[which]);
  const pad = add(c.pts[3] ?? OPEN_TIP, scale(c.pad, PADS));
  return assemble(bends, mix(OPEN_TIP, pad, w), META_OPEN);
}

/** The hand going `w` (0–1) of the way from open to a thumb up (the other fingers closed). */
export function thumbUp(w: number): Skeleton {
  return assemble(
    mixBends(OPEN, FIST, w),
    mix(OPEN_TIP, UP_TIP, w),
    norm(mix(META_OPEN, META_UP, w)),
  );
}

/** The joint a pinch of `which` touches. */
export const touched = (which: Pinch) => TIP[which];
