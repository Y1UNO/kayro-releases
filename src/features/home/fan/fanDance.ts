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
  /**
   * 30/10: the selected (middle) card leaves the ring this much earlier (ms at speed 1): it lands
   * with its impact while the others still whirl round, so nothing ever stops all at once.
   */
  lead: 240,
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
 * Lays the dance over the tracks `v` at time t (ms, speed already applied to `dur`, `wave` and
 * `lead`). `slots`: the app slots on screen (k = 0…4, x = carousel place; 2 = the selected one).
 */
export function danceOverlay(
  v: Map<string, number>,
  slots: readonly { k: number; x: number }[],
  t: number,
  dur: number,
  wave: number,
  lead = 0,
): void {
  if (dur <= 0) return;
  const rx = Math.max(200, ...slots.map((s) => Math.abs(s.x))) * DANCE.rxShare;
  // The ring turns once over the whole dance, the cards joining and leaving it on the way.
  const turn = TURN(clamp01(t / (dur + wave * (SEATS - 1))));
  for (const { k } of slots) {
    const u = (t - k * wave) / (k === 2 ? dur - lead : dur);
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

/**
 * The landing of a tab change (30/10, « elle avance en tremblant en arrivant vers le centre, s'y
 * écrase, et les autres continuent de virevolter »): the selected card leaves the ring first
 * (`DANCE.lead`); on its way down it comes forward and grows with a light shake, squashes as it
 * reaches its place, then settles while the shake dies out, the other cards still dancing. The
 * game's colours change at the squash (`impactAt`, gameColors/store.ts `holdGameColors`).
 */
export const IMPACT = {
  /**
   * Coming forward and growing (the end of its way down), then the squash (ms at speed 1); 2nd
   * pass of 30/10: slower, in the dance's rhythm, the settling ending just after the last card.
   */
  rise: 440,
  squash: 190,
  /** Settling, the shake dying out (ms). */
  settle: 440,
  lift: 12,
  grow: 1.09,
  flat: 0.94,
  /** Sideways shake (px) and its period (ms). */
  shake: 2,
  period: 95,
} as const;
const RISE = curveOf("cubic-bezier(.22,1,.36,1)");
const SQUASH = curveOf("cubic-bezier(.7,0,.84,0)");
const SETTLE = curveOf("cubic-bezier(.16,1,.3,1)");

/** When the selected card squashes at its place (ms from the dance's start, speed 1). */
export const impactAt = (dur: number) => (dur > 0 ? dur - DANCE.lead + DANCE.wave * 2 : 0);

/** When its landing starts (it is still coming down then). */
export const impactStart = (dur: number) =>
  dur > 0 ? impactAt(dur) - IMPACT.rise - IMPACT.squash : 0;

/** Whole length of a dancing tab change (ms at speed 1): the dance or the landing, the later. */
export const tabSpan = (dur: number) =>
  dur > 0 ? Math.max(danceSpan(dur), impactAt(dur) + IMPACT.settle) : 0;

/** The selected card's lift (px, up < 0), scale and shake at τ ms into its landing (speed 1). */
export function impactPose(tau: number): { y: number; sc: number; x: number } {
  const { rise, squash, settle, lift, grow, flat, shake, period } = IMPACT;
  if (tau <= 0 || tau >= rise + squash + settle) return { y: 0, sc: 1, x: 0 };
  const swing = shake * Math.sin((2 * Math.PI * tau) / period);
  if (tau < rise) {
    const e = RISE(tau / rise);
    return { y: -lift * e, sc: lerp(1, grow, e), x: swing * 0.6 * e };
  }
  if (tau < rise + squash) {
    const e = SQUASH((tau - rise) / squash);
    return { y: lerp(-lift, 2, e), sc: lerp(grow, flat, e), x: swing };
  }
  const u = (tau - rise - squash) / settle;
  const e = SETTLE(u);
  return { y: lerp(2, 0, e), sc: lerp(flat, 1, e), x: swing * (1 - u) * (1 - u) };
}

/** Lays the landing over the selected card (slot k = 2) at time t; `start`, t: scaled ms. */
export function impactOverlay(v: Map<string, number>, t: number, start: number, speed: number) {
  const p = impactPose((t - start) * speed);
  if (p.sc === 1 && p.y === 0) return;
  v.set("a2.x", (v.get("a2.x") ?? 0) + p.x);
  v.set("a2.y", (v.get("a2.y") ?? 0) + p.y);
  v.set("a2.sc", (v.get("a2.sc") ?? 1) * p.sc);
}
