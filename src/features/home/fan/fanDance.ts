import { curveOf, lerp } from "../../../design/motion/curve";

/**
 * The dance of a tab change (review 2026-10-29, « une chorégraphie, pas un tas au centre »): the
 * five cards leave their places for a wide ring seen in perspective (the whole stage), go round it
 * once together (the ones at the back smaller and higher, so they pass over and under each other),
 * and come down to their places again. They join and leave the ring in a wave, left to right.
 * Pure function of time, laid over the tracks of the sequence (fanTimeline.ts).
 */
export const DANCE = {
  /** The ring's half-width: this share of the outermost card's distance to the centre. */
  rxShare: 0.92,
  /** Height of the ring: a card at the back is 2 × ry px higher. */
  ry: 46,
  /** Scale at the front and at the back of the ring. */
  front: 0.84,
  back: 0.5,
  /** Lean along the ring (deg). */
  tilt: 5,
  /** Delay from one card to the next (ms). */
  wave: 45,
  /** Share of a card's dance spent joining the ring, and where it starts leaving it. */
  join: 0.26,
  leave: 0.74,
} as const;
const SEATS = 5;
const TURN = curveOf("cubic-bezier(.45,0,.3,1)");

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** How much a card is on the ring at its own progress u (0 and 1: at its place). */
export function ringWeight(u: number): number {
  return smooth(0, DANCE.join, u) * (1 - smooth(DANCE.leave, 1, u));
}

/** Pose on the ring at angle θ (rad, 0 = front centre); z: −4 at the back, 4 at the front. */
export function ringPose(theta: number, rx: number) {
  const d = Math.cos(theta);
  return {
    x: rx * Math.sin(theta),
    y: -DANCE.ry * (1 - d),
    sc: lerp(DANCE.back, DANCE.front, (d + 1) / 2),
    rot: -Math.sin(theta) * DANCE.tilt,
    z: 4 * d,
  };
}

/** Whole length of the dance (ms at speed 1) for one card's `dur`. */
export const danceSpan = (dur: number) => (dur > 0 ? dur + DANCE.wave * (SEATS - 1) : 0);

/**
 * Lays the dance over the tracks `v` at time t (ms, speed already applied to `dur` and `wave`).
 * `slots`: the app slots on screen (k = 0…4, x = carousel place).
 */
export function danceOverlay(
  v: Map<string, number>,
  slots: readonly { k: number; x: number }[],
  t: number,
  dur: number,
  wave: number,
): void {
  if (dur <= 0) return;
  const rx = Math.max(200, ...slots.map((s) => Math.abs(s.x))) * DANCE.rxShare;
  // The ring turns once over the whole dance, the cards joining and leaving it on the way.
  const turn = TURN(clamp01(t / (dur + wave * (SEATS - 1))));
  for (const { k } of slots) {
    const u = (t - k * wave) / dur;
    if (u <= 0 || u >= 1) continue;
    const w = ringWeight(u);
    const p = ringPose(((k - 2) / SEATS + turn) * 2 * Math.PI, rx);
    for (const [key, to] of [
      ["x", p.x],
      ["y", p.y],
      ["sc", p.sc],
      ["rot", p.rot],
      ["z", p.z],
    ] as const) {
      const id = `a${k}.${key}`;
      v.set(id, lerp(v.get(id) ?? to, to, w));
    }
    // Names and letters fade on the ring (the DOM text sits above the engine's glass).
    v.set(`a${k}.f`, (v.get(`a${k}.f`) ?? 1) * (1 - w));
  }
}
