/**
 * Hover and floating of the category fan (art direction round 3b, `categoryHover`).
 *
 * - Floating (round 5, ../float/cardFloat.ts): each of the five cards rises and falls on its own
 *   rhythm, at the level of the settings (« Flottaison des cartes »). More on the card under the
 *   pointer. None with reduced motion.
 * - Hover: the card lifts, grows a little and tilts towards the pointer (DOM); the glass engine
 *   draws two crisp light threads running round its rim in opposite directions and a few sparks
 *   leaving them (cues.ts). The level goes 0 → 1 in `hoverMs` with the spec's curve.
 *
 * Pure functions of time (tested) + a small state holder; the frame loop that drives it exists
 * only while the fan is on screen and something moves.
 */
import type { ElementValues } from "../../../design/da/daParams";
import { springAt, SPRINGS } from "../../../design/glass/pillMotion";
import { curveOf, lerp } from "../../../design/motion/curve";
import { EASES } from "../../../design/motion/eases";
import { floatAt, floatLevel, seed } from "../float/cardFloat";
import { FAN_SIZE } from "./fanTimeline";

/** The hover-in's curve: the spec's, « premium » of the table. */
const HOVER_EASE = curveOf(EASES.premium!);
// Physical constants of the hover (round 3b), not tunable on purpose (review B9): they set how
// the threads and sparks behave, not a duration or a curve of the motion language. The tunable
// part is the `categoryHover` element of the catalogue.
/** The tilt follows the pointer closely (round 3b, "more reactive"): time constant (ms). */
const TILT_TAU_MS = 55;
/** Hover-in burst: a flash on the rim, the threads whip round, the sparks fly further. */
const BURST_TAU_MS = 260;
/** Spark budget of one rim (the carousel's cards take 4 of them). */
export const MAX_SPARKS = 12;
/** Life of a spark (ms). */
const SPARK_LIFE = 750;

export interface HoverConfig {
  hoverMs: number;
  /** Overshoot of the hover-in (a spring of SPRINGS: 0 = none). */
  bounce: number;
  /** Strength of the hover-in burst (0–1). */
  burst: number;
  lift: number;
  tilt: number;
  grow: number;
  threads: boolean;
  threadSpeed: number;
  threadIntensity: number;
  /** Tail of a thread, as a fraction of the rim. */
  threadLength: number;
  threadWidth: number;
  /** Halo at the heads (0–1), pulsing. */
  threadGlow: number;
  sparks: number;
  sparkSize: number;
  /** Floating at rest (px, ±), its rocking (deg, ±) and period (ms): the settings' level. */
  floatRest: number;
  floatTilt: number;
  floatHover: number;
  floatPeriod: number;
  /** Hovered card: slow pivot left / right round a vertical axis (deg, within the 3° tilt). */
  sway: number;
  swayPeriod: number;
  reduced: boolean;
}

const num = (v: ElementValues | undefined, k: string, d: number) =>
  typeof v?.[k] === "number" ? (v[k] as number) : d;

/**
 * Settings (defaults of the catalogue). Reduced motion: no floating, no motion at all. `crisp`
 * (« Mouvement : Net », review A5): no spring, no burst, no threads nor sparks; the lift, the tilt
 * and the floating stay.
 */
export function hoverConfig(
  v: ElementValues | undefined,
  eco: boolean,
  reduced: boolean,
  crisp = false,
): HoverConfig {
  const off = v?.on === false;
  const level = floatLevel(v?.float);
  const sparks = Math.min(MAX_SPARKS, Math.max(0, Math.round(num(v, "sparks", 12))));
  const noMagic = off || reduced || crisp;
  return {
    hoverMs: reduced ? 0 : num(v, "hoverMs", 240),
    bounce: reduced || crisp ? 0 : (SPRINGS[String(v?.hoverSpring ?? "leger")] ?? 0),
    burst: noMagic ? 0 : num(v, "burst", 0.8),
    lift: off || reduced ? 0 : num(v, "lift", 12),
    tilt: off || reduced ? 0 : Math.min(3, num(v, "tilt", 3)),
    grow: off || reduced ? 0 : num(v, "grow", 0.03),
    threads: !off && !crisp && v?.threads !== false,
    threadSpeed: reduced ? 0 : num(v, "threadSpeed", 0.25),
    threadIntensity: num(v, "threadIntensity", 1.8),
    threadLength: num(v, "threadLength", 0.2),
    threadWidth: num(v, "threadWidth", 2.2),
    threadGlow: num(v, "threadGlow", 0.9),
    // Eco: half the sparks (30 images/s already).
    sparks: noMagic ? 0 : eco ? Math.ceil(sparks / 2) : sparks,
    sparkSize: num(v, "sparkSize", 2.4),
    floatRest: off || reduced ? 0 : level.fan,
    floatTilt: level.tilt,
    floatHover: off || reduced ? 0 : num(v, "floatHover", 6),
    floatPeriod: level.period,
    sway: off || reduced ? 0 : Math.min(3, num(v, "sway", 2)),
    swayPeriod: Math.max(1, num(v, "swayPeriod", 3.6)) * 1000,
    reduced,
  };
}

/** Phase (0–1 of a turn) of the light threads at time t. */
export function threadPhase(t: number, speed: number, reduced: boolean): number {
  if (reduced) return 0.125;
  const v = (t / 1000) * speed;
  return v - Math.floor(v);
}

/** Perimeter of a w × h box with corners of radius r (length of its `inset(0 round r)` path). */
export function perimeter(w: number, h: number, r: number): number {
  return 2 * (w + h) - (8 - 2 * Math.PI) * r;
}

type RimPoint = [x: number, y: number, nx: number, ny: number];

/**
 * Point of the rim at arc length d, as CSS `offset-path: inset(0 round r)` walks it: from the
 * top edge's left end, clockwise. Local coordinates (top-left of the box) and outward normal.
 */
export function pathPoint(d: number, w: number, h: number, r: number): RimPoint {
  const arc = (cx: number, cy: number, a: number): RimPoint => [
    cx + Math.cos(a) * r,
    cy + Math.sin(a) * r,
    Math.cos(a),
    Math.sin(a),
  ];
  const q = (Math.PI / 2) * r;
  const sides: [number, (u: number) => RimPoint][] = [
    [w - 2 * r, (u) => [r + u, 0, 0, -1]],
    [q, (u) => arc(w - r, r, -Math.PI / 2 + u / r)],
    [h - 2 * r, (u) => [w, r + u, 1, 0]],
    [q, (u) => arc(w - r, h - r, u / r)],
    [w - 2 * r, (u) => [w - r - u, h, 0, 1]],
    [q, (u) => arc(r, h - r, Math.PI / 2 + u / r)],
    [h - 2 * r, (u) => [0, h - r - u, -1, 0]],
    [q, (u) => arc(r, r, Math.PI + u / r)],
  ];
  const P = perimeter(w, h, r);
  let s = ((d % P) + P) % P;
  for (const [len, at] of sides) {
    if (s <= len) return at(s);
    s -= len;
  }
  return [r, 0, 0, -1];
}

/** Arc length of the heads: thread A clockwise from the top, thread B the other way from the bottom. */
export function threadHeads(phase: number, P: number): [number, number] {
  return [phase * P, P / 2 - phase * P];
}

/**
 * Sparks at time t, written as (x, y, size, alpha) into `out` in the card's own coordinates
 * (top-left origin); returns how many. Spark j is born at a thread head every SPARK_LIFE / n ms
 * (alternately on each thread), drifts outwards and up, shrinks and fades. A pure function of
 * time: seekable and the same in captures.
 */
export function sparksAt(
  t: number,
  n: number,
  level: number,
  box: { w: number; h: number; r: number },
  phaseAt: (t: number) => number,
  size: number,
  out: Float32Array,
  boost = 0,
): number {
  const count = Math.min(MAX_SPARKS, n);
  if (count <= 0 || level <= 0.01) return 0;
  const P = perimeter(box.w, box.h, box.r);
  for (let j = 0; j < count; j++) {
    const shift = (j / count) * SPARK_LIFE;
    const age = (((t + shift) % SPARK_LIFE) + SPARK_LIFE) % SPARK_LIFE;
    const u = age / SPARK_LIFE;
    const heads = threadHeads(phaseAt(t - age), P);
    const [x, y, nx, ny] = pathPoint(heads[j % 2]!, box.w, box.h, box.r);
    const drift = (6 + 10 * seed(j, 7)) * u * (1 + 1.6 * boost);
    const o = j * 4;
    out[o] = x + nx * drift + (seed(j, 8) - 0.5) * 8 * u;
    out[o + 1] = y + ny * drift - 10 * u * u;
    out[o + 2] = size * (1 - 0.6 * u);
    out[o + 3] = Math.min(
      1,
      level * Math.sin(Math.PI * u) * (0.6 + 0.4 * seed(j, 9)) * (1 + boost),
    );
  }
  return count;
}

interface Tween {
  from: number;
  to: number;
  start: number;
}

/** What card i adds to its pose at time `now`. */
export interface FanMotionSample {
  dx: number;
  dy: number;
  rot: number;
  /** Hover level 0–1. */
  h: number;
  /** Floating height for the ground shadow, 0–1 (cardFloat.ts). */
  elev: number;
  lift: number;
  grow: number;
  tiltX: number;
  tiltY: number;
}

/** Hover levels, pointer tilt and floating of the five cards (driven by one frame loop). */
export class FanMotion {
  private readonly levels: Tween[] = Array.from({ length: FAN_SIZE }, () => ({
    from: 0,
    to: 0,
    start: -1e9,
  }));
  private readonly tilt = Array.from({ length: FAN_SIZE }, () => ({ x: 0, y: 0, tx: 0, ty: 0 }));
  private last = -1;

  constructor(public config: HoverConfig) {}

  level(i: number, now: number): number {
    const tw = this.levels[i]!;
    const d = this.config.hoverMs;
    if (d <= 0) return tw.to;
    const u = Math.min(1, (now - tw.start) / d);
    // In: a light spring (passes 1 a little: the card "pops"); out: settles without a bounce.
    return lerp(tw.from, tw.to, tw.to > tw.from ? springAt(u, this.config.bounce) : HOVER_EASE(u));
  }

  /** Hover-in burst of card i (1 at the start of the hover, gone in ~1 s), 0 otherwise. */
  burst(i: number, now: number): number {
    const tw = this.levels[i]!;
    const dt = now - tw.start;
    if (tw.to !== 1 || dt < 0 || dt > 1200 || this.config.burst <= 0) return 0;
    return this.config.burst * Math.exp(-dt / BURST_TAU_MS);
  }

  /** Phase of card i's threads: their steady run + a quick half turn at the hover-in. */
  phase(i: number, now: number): number {
    const c = this.config;
    const tw = this.levels[i]!;
    const whip =
      tw.to === 1 && !c.reduced ? 0.5 * c.burst * (1 - Math.exp(-(now - tw.start) / 300)) : 0;
    return threadPhase(now, c.threadSpeed, c.reduced) + whip;
  }

  setHover(i: number, on: boolean, now: number): void {
    const tw = this.levels[i];
    if (!tw || tw.to === (on ? 1 : 0)) return;
    const from = this.level(i, now);
    this.levels[i] = { from, to: on ? 1 : 0, start: now };
    if (!on) this.setPointer(i, 0, 0);
  }

  /** Pointer over card i, −1…1 on each axis (0, 0 = centre or left). */
  setPointer(i: number, nx: number, ny: number): void {
    const t = this.tilt[i];
    if (!t) return;
    t.tx = Math.max(-1, Math.min(1, nx));
    t.ty = Math.max(-1, Math.min(1, ny));
  }

  /** The card with the highest hover level (the one the engine dresses), or −1. */
  hovered(now: number): number {
    let best = -1;
    let h = 0.005;
    for (let i = 0; i < FAN_SIZE; i++) {
      const l = this.level(i, now);
      if (l > h) {
        h = l;
        best = i;
      }
    }
    return best;
  }

  /** Something still changes (the frame loop must go on). */
  busy(now: number): boolean {
    const c = this.config;
    // « Flottaison : Aucune »: nothing moves at rest (review A4b); the hover floating only counts
    // on a hovered card.
    if (c.floatRest > 0) return true;
    for (let i = 0; i < FAN_SIZE; i++) {
      const tw = this.levels[i]!;
      const moves = c.threads || c.sparks > 0 || c.sway > 0 || c.floatHover > 0;
      if (tw.to > 0 && moves && !c.reduced) return true;
      if (now - tw.start < c.hoverMs) return true;
      const t = this.tilt[i]!;
      if (Math.abs(t.x - t.tx) > 1e-3 || Math.abs(t.y - t.ty) > 1e-3) return true;
    }
    return false;
  }

  /** Only the floating moves: nothing hovered or easing, the tilt settled (round 5: 30 i/s). */
  floatingOnly(now: number): boolean {
    for (let i = 0; i < FAN_SIZE; i++) {
      const tw = this.levels[i]!;
      if (tw.to > 0 || now - tw.start < this.config.hoverMs) return false;
      const t = this.tilt[i]!;
      if (Math.abs(t.x - t.tx) > 1e-3 || Math.abs(t.y - t.ty) > 1e-3) return false;
    }
    return true;
  }

  /** Advances the pointer tilt (smoothed) to `now`. */
  step(now: number): void {
    const dt = this.last < 0 ? 0 : Math.min(100, now - this.last);
    this.last = now;
    const k = 1 - Math.exp(-dt / TILT_TAU_MS);
    for (const t of this.tilt) {
      t.x += (t.tx - t.x) * k;
      t.y += (t.ty - t.y) * k;
    }
  }

  sample(i: number, now: number): FanMotionSample {
    const c = this.config;
    const h = this.level(i, now);
    const amp = lerp(c.floatRest, Math.max(c.floatRest, c.floatHover), h);
    const f = floatAt(i, now, amp, c.floatTilt, c.floatPeriod);
    const t = this.tilt[i]!;
    // Hovered, the card floats: it pivots slowly left and right round a vertical axis, rocks a
    // hair, and drifts a little more sideways. The pointer tilt adds up, never past 3°.
    const w = (2 * Math.PI * now) / c.swayPeriod;
    const sway = c.sway * h * Math.sin(w + seed(i, 6) * 6.28);
    const clamp3 = (x: number) => Math.max(-3, Math.min(3, x));
    // Hovered, it also drifts a little sideways (round 3b), on a slower rhythm of its own.
    const drift = 0.66 * c.floatHover * h * Math.sin((w * 0.5) / 1.3 + seed(i, 4) * 6.28);
    return {
      dx: drift,
      dy: f.dy,
      rot: f.rot + c.sway * 0.15 * h * Math.sin(w * 0.77 + 1.1),
      h,
      elev: f.elev,
      lift: c.lift * h,
      grow: c.grow * h,
      // The side under the pointer goes slightly back (like the carousel cards).
      tiltX: clamp3(-t.y * c.tilt * h),
      tiltY: clamp3(t.x * c.tilt * h + sway),
    };
  }
}
