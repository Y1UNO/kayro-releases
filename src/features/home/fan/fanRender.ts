import type { GlassPose, HoverCue } from "../../../fx/gpu/cues";
import { MAX_SPARKS, perimeter, sparksAt, threadHeads, type FanMotion } from "./fanFloat";
import { CARD, type LinkConfig, type Phase, type Values } from "./fanTimeline";

/** Elements of one category card of the fan. */
export interface FanCardEls {
  /** Turns around the pivot (`transform-origin` 1 300 px below the card's centre). */
  wrap: HTMLElement;
  /** The glass card (hit box, drawn by the engine): sequence lift and scale. */
  card: HTMLElement;
  /** Its picture inside: hover lift, growth, tilt and floating (the hit box stays still). */
  lift: HTMLElement | null;
  /** Fixed blurred copy of the card's content, cross-faded in (no animated filter). */
  blurred: HTMLElement | null;
  /** Light threads: SEGMENTS spans for thread A, then SEGMENTS for B (along an `offset-path`). */
  threads: readonly HTMLElement[];
  /** Sparks (MAX_SPARKS spans). */
  sparks: readonly HTMLElement[];
  /** Halo at the head of thread A and of thread B. */
  heads: readonly HTMLElement[];
  /** Flash of the whole rim at the hover-in (burst). */
  flash: HTMLElement | null;
}

/** Each thread is drawn as a few short strokes along the rim: its tail bends round the corners. */
export const SEGMENTS = 10;

const FAN_Z = 100;
const DEG = Math.PI / 180;
const sparkBuf = new Float32Array(MAX_SPARKS * 4);

/** Writes a style only when it changes (the fan floats: most values change, some never do). */
export function put(el: HTMLElement, prop: "transform" | "opacity" | "zIndex", v: string): void {
  if (el.style[prop] !== v) el.style[prop] = v;
}

/**
 * Draws the fan's cards at one moment: sequence values (fanTimeline.ts) + floating and hover
 * (fanFloat.ts). Writes transform / opacity, fills `poses` for the glass engine and returns the
 * hover cue of the card under the pointer (threads, sparks), or null.
 */
export function renderFan(
  cards: readonly (FanCardEls | null)[],
  v: Values,
  phase: Phase,
  cat: number,
  c: LinkConfig,
  origin: { x: number; y: number },
  motion: FanMotion | null,
  now: number,
  poses: Map<Element, GlassPose>,
): HoverCue | null {
  const g = (k: string, d = 0) => v.get(k) ?? d;
  const choose = phase === "choose";
  motion?.step(now);
  const hi = motion ? motion.hovered(now) : -1;
  let hover: HoverCue | null = null;
  for (let i = 0; i < cards.length; i++) {
    const el = cards[i];
    if (!el) continue;
    const rot = g(`c${i}.rot`);
    const ty = g(`c${i}.ty`);
    const sc = g(`c${i}.sc`, 1);
    const blur = g(`c${i}.blur`);
    const sel = i === cat && !choose;
    const m = motion?.sample(i, now);
    const h = i === hi && m ? m.h : 0;
    // The hovered card comes in front of its neighbours (its rim, threads and sparks show whole).
    const z = sel ? 20 : h > 0.01 ? 15 : 10 - Math.abs(i - 2);
    put(el.wrap, "transform", `rotate(${rot.toFixed(3)}deg)`);
    put(el.wrap, "opacity", g(`c${i}.o`, 1).toFixed(3));
    put(el.wrap, "zIndex", String(z));
    put(el.card, "transform", `translateY(${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`);
    put(el.card, "opacity", g(`c${i}.io`, 1).toFixed(3));
    if (el.blurred) put(el.blurred, "opacity", c.blur > 0 ? (blur / c.blur).toFixed(3) : "0");
    const dx = m?.dx ?? 0;
    const dy = (m?.dy ?? 0) - (m?.lift ?? 0);
    const grow = 1 + (m?.grow ?? 0);
    if (el.lift) {
      put(
        el.lift,
        "transform",
        `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${(m?.rot ?? 0).toFixed(3)}deg) ` +
          `scale(${grow.toFixed(4)}) rotateX(${(m?.tiltX ?? 0).toFixed(2)}deg) rotateY(${(m?.tiltY ?? 0).toFixed(2)}deg)`,
      );
    }
    // Centre: the pivot, then the card's offset in its own (turned) frame.
    const a = (rot + (m?.rot ?? 0)) * DEG;
    const ra = rot * DEG;
    const lx = sc * dx;
    const ly = ty + sc * dy - c.pivot;
    const px = origin.x;
    const py = origin.y + c.pivot;
    const pose: GlassPose = {
      x: px + Math.cos(ra) * lx - Math.sin(ra) * ly,
      y: py + Math.sin(ra) * lx + Math.cos(ra) * ly,
      hw: (CARD.w / 2) * sc * grow,
      hh: (CARD.h / 2) * sc * grow,
      r: CARD.r * sc * grow,
      a,
      soft: blur,
      z: FAN_Z + z,
    };
    poses.set(el.card, pose);
    if (h > 0) hover = { el: el.card, h };
    domHover(el, i, h, motion, now);
  }
  return hover;
}

const P = perimeter(CARD.w, CARD.h, CARD.r);

/**
 * Light threads and sparks of a card (DOM, above the other cards: the engine draws under the DOM,
 * so where cards overlap it could not show them). Theme colours A → B (CSS), transform / opacity.
 */
function domHover(
  el: FanCardEls,
  i: number,
  h: number,
  motion: FanMotion | null,
  now: number,
): void {
  const cfg = motion?.config;
  const shown = h > 0.005 && cfg !== undefined && motion !== null;
  const threads = shown && cfg.threads;
  const burst = shown ? motion.burst(i, now) : 0;
  if (el.flash) put(el.flash, "opacity", Math.min(1, burst * Math.min(1, h) * 1.2).toFixed(3));
  for (const t of el.threads) if (!threads) put(t, "opacity", "0");
  for (const t of el.heads) if (!threads) put(t, "opacity", "0");
  for (const sp of el.sparks) if (!shown) put(sp, "opacity", "0");
  if (!shown) return;
  if (threads && el.threads.length === 2 * SEGMENTS) {
    const heads = threadHeads(motion.phase(i, now), P);
    const step = (cfg.threadLength * P) / SEGMENTS;
    for (let k = 0; k < 2 * SEGMENTS; k++) {
      const b = k >= SEGMENTS; // thread B runs the other way: its tail is ahead in path terms
      const j = k % SEGMENTS;
      const d = heads[b ? 1 : 0]! + (b ? 1 : -1) * (j + 0.5) * step;
      const t = el.threads[k]!;
      t.style.offsetDistance = `${d.toFixed(1)}px`;
      const w = `${(step + 1.5).toFixed(1)}px`;
      if (t.style.width !== w) t.style.width = w;
      const th = `${cfg.threadWidth}px`;
      if (t.style.height !== th) t.style.height = th;
      const fade = Math.pow(1 - j / SEGMENTS, 1.5);
      put(t, "opacity", Math.min(1, h * cfg.threadIntensity * fade * (1 + burst)).toFixed(3));
    }
    // Head halos: a soft glow that breathes (1.6 pulses a second; still with reduced motion).
    const pulse = cfg.reduced ? 1 : 0.7 + 0.3 * Math.sin((now / 1000) * 2 * Math.PI * 1.6);
    el.heads.forEach((hd, b) => {
      hd.style.offsetDistance = `${heads[b]!.toFixed(1)}px`;
      put(hd, "opacity", Math.min(1, h * cfg.threadGlow * (pulse + burst)).toFixed(3));
    });
  }
  const phaseAt = (t: number) => motion.phase(i, t);
  const n = sparksAt(
    now,
    cfg.sparks,
    Math.min(1, h),
    CARD,
    phaseAt,
    cfg.sparkSize,
    sparkBuf,
    burst,
  );
  el.sparks.forEach((sp, j) => {
    if (j >= n) return put(sp, "opacity", "0");
    const o = j * 4;
    const x = sparkBuf[o]!;
    const y = sparkBuf[o + 1]!;
    const k = sparkBuf[o + 2]! / 3; // the span is 6 px wide
    put(
      sp,
      "transform",
      `translate(${(x - 3).toFixed(1)}px, ${(y - 3).toFixed(1)}px) scale(${k.toFixed(3)})`,
    );
    put(sp, "opacity", sparkBuf[o + 3]!.toFixed(3));
  });
}
