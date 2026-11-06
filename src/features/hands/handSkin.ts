/**
 * The model's 25 bones posed from the tutorial's hand (handPose.ts, 21 points and their bend
 * axes): each bone keeps its length and shape and only turns, from its rest frame (along the
 * bone, round its bend axis) to the pose's. The metacarpals of the four fingers stay with the
 * wrist (the palm is rigid). Pure maths: the matrices (column-major) for the vertex shader.
 */

import { turnView, type Look } from "./handDraw";
import type { HandModel, Quat, Vec3 } from "./handModel";
import { cross, dot, norm, sub, THUMB_POLE, type HandFrame, type V3 } from "./handPose";

type M3 = [V3, V3, V3]; // columns

/** The model's metres to the hand's frame: x = −z, y = −y, z = −x (a proper turn). */
const C: M3 = [
  [0, 0, -1],
  [0, -1, 0],
  [-1, 0, 0],
];

const mul3v = (m: M3, v: V3): V3 => [
  m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
  m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
  m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
];
const mul3 = (a: M3, b: M3): M3 => [mul3v(a, b[0]), mul3v(a, b[1]), mul3v(a, b[2])];
const transpose = (m: M3): M3 => [
  [m[0][0], m[1][0], m[2][0]],
  [m[0][1], m[1][1], m[2][1]],
  [m[0][2], m[1][2], m[2][2]],
];
const quat = ([x, y, z, w]: Quat): M3 => [
  [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)],
  [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)],
  [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)],
];
const I3: M3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** For each model bone: the pose's point it sits on (−1: a metacarpal, kept with the wrist),
 * the bone it points to, and whether it is the thumb's. */
const MP: number[] = [0, 1, 2, 3, 4];
const NEXT: number[] = [-1, 2, 3, 4, -1];
for (let f = 0; f < 4; f++) {
  MP.push(-1, 5 + 4 * f, 6 + 4 * f, 7 + 4 * f, 8 + 4 * f);
  const m = 5 + 5 * f;
  NEXT.push(-1, m + 2, m + 3, m + 4, -1);
}

/** A frame along a bone (`dir`), round its bend axis (`lat`): its columns. */
function frame(dir: V3, lat: V3): M3 {
  const l = norm(
    sub(lat, [dir[0] * dot(lat, dir), dir[1] * dot(lat, dir), dir[2] * dot(lat, dir)]),
  );
  return [dir, l, cross(dir, l)];
}

export interface Rest {
  /** Each bone's rest place in the hand's frame (cm, the wrist at 0). */
  at: V3[];
  /** Each bone's rest turn, in the hand's frame. */
  turn: M3[];
  /** Each bone's rest frame (along it, round its bend axis), for the bones that bend. */
  frame: (M3 | null)[];
}

export function rest(model: HandModel): Rest {
  const w = model.restT[0] ?? [0, 0, 0];
  const at = model.restT.map((t: Vec3) =>
    mul3v(C, [(t[0] - w[0]) * 100, (t[1] - w[1]) * 100, (t[2] - w[2]) * 100]),
  );
  const turn = model.restQ.map((q) => mul3(C, quat(q)));
  const frames = at.map((p, j) => {
    const next = NEXT[j] ?? -1;
    const q = at[next];
    if (next < 0 || !q) return null;
    const dir = norm(sub(q, p));
    const pole: V3 = j < 5 ? THUMB_POLE : [0, 0, 1];
    return frame(dir, norm(cross(dir, pole)));
  });
  return { at, turn, frame: frames };
}

/**
 * The 25 bone matrices (column-major, 16 floats each) that put the model in the pose `hand`,
 * turned by `look` round `centre` (cm): view = turn(look) · (hand − centre).
 */
export function bones(
  model: HandModel,
  r: Rest,
  hand: HandFrame,
  look: Look,
  centre: V3,
  out: Float32Array,
) {
  const view: M3 = [
    turnView([1, 0, 0], look),
    turnView([0, 1, 0], look),
    turnView([0, 0, 1], look),
  ];
  const wrist = hand.joints[0] ?? [0, 0, 0];
  const place = (j: number): V3 => {
    const mp = MP[j] ?? -1;
    const p = mp >= 0 ? hand.joints[mp] : undefined;
    const q = r.at[j] ?? [0, 0, 0];
    return p ?? [q[0] + wrist[0], q[1] + wrist[1], q[2] + wrist[2]];
  };
  const delta: M3[] = [];
  for (let j = 0; j < 25; j++) {
    const next = NEXT[j] ?? -1;
    const rf = r.frame[j];
    const mp = MP[j] ?? -1;
    if (next >= 0 && rf && mp >= 0) {
      const dir = norm(sub(place(next), place(j)));
      delta[j] = mul3(frame(dir, hand.lat[mp] ?? [1, 0, 0]), transpose(rf));
    } else {
      // A tip turns with its last phalanx; the wrist and the metacarpals do not turn.
      delta[j] = mp >= 0 && j % 5 === 4 ? (delta[j - 1] ?? I3) : I3;
    }
  }
  for (let j = 0; j < 25; j++) {
    const rot = mul3(view, mul3(delta[j] ?? I3, r.turn[j] ?? I3));
    const p = place(j);
    const t = mul3v(view, [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]]);
    // world = [rot · 100 | t] · ibm
    const ibm = model.ibm.subarray(j * 16, j * 16 + 16);
    for (let c = 0; c < 4; c++) {
      const x = ibm[c * 4] ?? 0;
      const y = ibm[c * 4 + 1] ?? 0;
      const z = ibm[c * 4 + 2] ?? 0;
      const h = ibm[c * 4 + 3] ?? 0;
      for (let k = 0; k < 3; k++) {
        out[j * 16 + c * 4 + k] =
          100 * ((rot[0][k] ?? 0) * x + (rot[1][k] ?? 0) * y + (rot[2][k] ?? 0) * z) +
          (t[k] ?? 0) * h;
      }
      out[j * 16 + c * 4 + 3] = h;
    }
  }
}
