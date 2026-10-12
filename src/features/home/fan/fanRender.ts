import type { GlassPose, HoverCue } from "../../../fx/gpu/cues";
import { put, renderRim, type RimEls } from "../rim/rimRender";
import type { FanMotion } from "./fanFloat";
import { CARD, type LinkConfig, type Phase, type Values } from "./fanTimeline";

/** Elements of one category card of the fan (threads, sparks, heads, flash: RimEls). */
export interface FanCardEls extends RimEls {
  /** Turns around the pivot (`transform-origin` 1 300 px below the card's centre). */
  wrap: HTMLElement;
  /** The glass card (hit box, drawn by the engine): sequence lift and scale. */
  card: HTMLElement;
  /** Its picture inside: hover lift, growth, tilt and floating (the hit box stays still). */
  lift: HTMLElement | null;
  /** Fixed blurred copy of the card's content, cross-faded in (no animated filter). */
  blurred: HTMLElement | null;
}

const FAN_Z = 100;
const DEG = Math.PI / 180;
/** Writes a style only when it changes (the fan floats: most values change, some never do). */
export { put };

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
      elev: m?.elev ?? 0,
    };
    poses.set(el.card, pose);
    if (h > 0) hover = { el: el.card, h };
    domHover(el, i, h, motion, now);
  }
  return hover;
}

/** Light threads and sparks of a card (shared with the carousel cards: ../rim/rimRender.ts). */
function domHover(
  el: FanCardEls,
  i: number,
  h: number,
  motion: FanMotion | null,
  now: number,
): void {
  const cfg = motion?.config;
  const shown = h > 0.005 && cfg !== undefined && motion !== null;
  const burst = shown ? motion.burst(i, now) : 0;
  renderRim(el, CARD, shown ? h : 0, cfg ?? null, burst, (t) => motion?.phase(i, t) ?? 0, now);
}
