/**
 * Level 3 "magie" of the carousel's app cards (art direction round 4a, "Vivant intelligent"):
 * the hovered card lifts on the "rebond" spring (CSS, Carousel.module.css); after `delay` of the
 * pointer on it (nothing lights up when the pointer just crosses the cards), one glossy veil
 * crosses it, then the fan's two light threads run round its rim with a few sparks. A launch
 * flashes the rim (A ring + halo). One card at a time: a single set of spans, moved to the card.
 *
 * Rules (spec "règle d'intelligence"): never while scrolling, dragging or during a category
 * sequence; not for the keyboard focus (pointer only); window mode: levels 1–2 only (no veil, no
 * threads, no flash); Eco: lift + veil only; reduced motion: nothing.
 */
import { curveOf, type Curve } from "../../../design/motion/curve";
import { EASES } from "../../../design/motion/eases";
import { MOTION_DEFAULTS, type MotionTokens } from "../../../design/motion/tokens";
import type { ElementValues } from "../../../design/da/daParams";
import { frameLoop, type FrameLoop } from "../../../fx/loop";
import { sheenAt } from "../../../fx/gpu/sheen";
import { hoverConfig, threadPhase } from "../fan/fanFloat";
import { sheenBandClass, sheenGlide } from "../SheenVeil";
import { createRimEls, renderRim, type RimBox, type RimEls, type RimLook } from "./rimRender";
import styles from "./Rim.module.css";

/** At most this many sparks on a carousel card (spec). */
export const CARD_SPARKS = 4;
/** Cadence of the threads (as the fan's: 60 images/s; never in Eco, which has no threads). */
const THREAD_FPS = 60;
/** A wheel turn this recent counts as scrolling. */
const WHEEL_QUIET_MS = 300;
/** The table's appearance curve by default (`fadeCurve` of the config). */
const APPEAR = curveOf(EASES[MOTION_DEFAULTS.easeIn]!);

export interface CardHoverConfig {
  /** Presence of the pointer before the veil and the threads (ms). */
  delay: number;
  veil: boolean;
  veilMs: number;
  threads: boolean;
  /** Threads fade in / out (ms), in on the table's appearance curve. */
  fadeIn: number;
  fadeOut: number;
  fadeCurve: Curve;
  flash: boolean;
  flashMs: number;
  /** Curve of the launch flash (CSS, from EASES). */
  flashEase: string;
  /** Look of the threads: the fan's settings, sparks capped. */
  look: RimLook;
  threadSpeed: number;
  /** The level 3 is in effect (else the reflection that follows the pointer stays). */
  magic: boolean;
}

export interface HoverContext {
  eco: boolean;
  reduced: boolean;
  /** Window mode: levels 1 and 2 only. */
  windowMode: boolean;
}

const num = (v: ElementValues | undefined, k: string, d: number) =>
  typeof v?.[k] === "number" ? (v[k] as number) : d;

/** What the hover of a carousel card may show, from the settings and the context (pure). */
export function cardHoverConfig(
  card: ElementValues | undefined,
  fan: ElementValues | undefined,
  t: MotionTokens,
  ctx: HoverContext,
): CardHoverConfig {
  // Round 5: « Survol des cartes » (full / simple / none) and « Mouvement » (complete: the magic
  // also in window mode; crisp: none) of the settings.
  const full = (card?.style ?? "full") === "full" && t.style !== "crisp";
  const windowCut = ctx.windowMode && t.style !== "complete";
  const magic = t.levels[2] && full && !windowCut && !ctx.reduced && card?.on !== false;
  const fanLook = hoverConfig(fan, false, ctx.reduced);
  const sparks = Math.min(CARD_SPARKS, Math.max(0, Math.round(num(card, "sparks", CARD_SPARKS))));
  const threads = magic && !ctx.eco && fanLook.threads;
  return {
    delay: num(card, "delay", 120),
    veil: magic,
    veilMs: num(card, "veilMs", 800),
    threads,
    fadeIn: t.dur.court,
    fadeOut: t.dur.court * t.outShare,
    fadeCurve: curveOf(t.ease.in),
    flash: magic && !ctx.eco,
    flashMs: t.dur.long * num(card, "launchFlash", 1.6),
    flashEase: EASES.detente!,
    look: { ...fanLook, threads, sparks: threads ? sparks : 0 },
    threadSpeed: fanLook.threadSpeed,
    magic,
  };
}

/** The card is moving or taken by something else: no decorative effect (rule 3). */
export function hoverBlocked(stage: HTMLElement, dragging: boolean, sinceWheel: number): boolean {
  return (
    dragging ||
    stage.dataset.fast !== undefined ||
    stage.dataset.seq !== undefined ||
    sinceWheel < WHEEL_QUIET_MS
  );
}

/**
 * Level of the threads at `now` (0–1): nothing before `delay`, then in over `fadeIn`; after the
 * pointer left (`leftAt`, with `from` = the level then), out over `fadeOut`.
 */
export function threadLevel(
  now: number,
  enterAt: number,
  c: Pick<CardHoverConfig, "delay" | "fadeIn" | "fadeOut"> &
    Partial<Pick<CardHoverConfig, "fadeCurve">>,
  leftAt = -1,
  from = 0,
): number {
  if (leftAt >= 0) return c.fadeOut <= 0 ? 0 : from * Math.max(0, 1 - (now - leftAt) / c.fadeOut);
  const u = c.fadeIn <= 0 ? 1 : (now - enterAt - c.delay) / c.fadeIn;
  return u <= 0 ? 0 : (c.fadeCurve ?? APPEAR)(Math.min(1, u));
}

/** Drives the level 3 of one carousel (one per stage). */
export class CardHoverFx {
  private layer: HTMLSpanElement | null = null;
  private els: RimEls | null = null;
  private band: HTMLSpanElement | null = null;
  /** The card under the pointer: waiting for its `delay`, or lit. */
  private card: HTMLElement | null = null;
  private box: RimBox = { w: 0, h: 0, r: 30 };
  private enterAt = 0;
  /** The threads of the card last lit fade out since then (−1: none), from level `leftFrom`. */
  private leftAt = -1;
  private leftFrom = 0;
  /** `card`'s veil and threads are on. */
  private lit = false;
  private timer = 0;
  private off: (() => void) | null = null;
  private wheelAt = -1e9;
  dragging = false;

  constructor(
    private readonly stage: HTMLElement,
    public config: CardHoverConfig,
    /**
     * The periodic veil of the selected card glides now (rule 1: one decorative effect). Replaced
     * when the `cardSheen` settings change (Carousel.tsx).
     */
    public periodicGlide: (card: HTMLElement, now: number) => boolean = () => false,
    private readonly loop: () => FrameLoop = frameLoop,
  ) {}

  /** The pointer is over `card` (a card button of the carousel), or over no card (null). */
  pointer(card: HTMLElement | null, now = performance.now()): void {
    if (card === this.card) return;
    if (this.card) this.leave(now);
    if (card) this.enter(card, now);
  }

  wheel(now = performance.now()): void {
    this.wheelAt = now;
    if (this.card) this.leave(now);
  }

  /** The active card was clicked to launch its app: the rim flashes (A ring + halo). */
  launch(card: HTMLElement): void {
    const c = this.config;
    if (!c.flash) return;
    this.attach(card);
    const flash = this.els?.flash;
    if (!flash) return;
    for (const a of flash.getAnimations()) a.cancel();
    flash.animate(
      [
        { opacity: 0, transform: "scale(1)" },
        { opacity: 1, transform: "scale(1.02)", offset: 0.18 },
        { opacity: 0, transform: "scale(1.07)" },
      ],
      { duration: c.flashMs, easing: c.flashEase },
    );
  }

  dispose(): void {
    window.clearTimeout(this.timer);
    this.stop();
    this.layer?.remove();
    this.layer = null;
    this.card = null;
    this.lit = false;
    this.leftAt = -1;
  }

  private enter(card: HTMLElement, now: number): void {
    this.card = card;
    this.enterAt = now;
    this.lit = false;
    window.clearTimeout(this.timer);
    const c = this.config;
    if (!c.veil && !c.threads) return;
    // One set of spans: the threads of the card just left fade out first, then this one lights.
    const fading = this.leftAt >= 0 ? this.leftAt + c.fadeOut - now : 0;
    this.timer = window.setTimeout(() => this.light(card), Math.max(c.delay, fading));
  }

  private leave(now: number): void {
    window.clearTimeout(this.timer);
    if (!this.card) return;
    if (this.lit && this.off) {
      this.leftFrom = threadLevel(now, this.enterAt, this.config);
      this.leftAt = now;
    }
    this.card = null;
    this.lit = false;
    // Nothing lit, nothing fading: no frame loop left running.
    if (this.leftAt < 0) this.stop();
  }

  /** The pointer stayed `delay` on the card: veil, then threads. */
  private light(card: HTMLElement): void {
    const now = performance.now();
    if (this.card !== card) return;
    if (hoverBlocked(this.stage, this.dragging, now - this.wheelAt)) return;
    const c = this.config;
    this.attach(card);
    this.lit = true;
    // The threads come in from now (later than `delay` when another card's faded out first).
    this.enterAt = now - c.delay;
    this.leftAt = -1;
    if (c.veil && this.band && !this.periodicGlide(card, now)) sheenGlide(this.band, c.veilMs);
    if (c.threads) this.run();
  }

  /** Moves the layer into the card's slot (after the card), sized like it. */
  private attach(card: HTMLElement): void {
    const slot = card.parentElement;
    if (!slot) return;
    if (!this.layer) {
      const layer = document.createElement("span");
      layer.className = styles.layer!;
      layer.dataset.rim = "";
      layer.setAttribute("aria-hidden", "true");
      const veil = document.createElement("span");
      veil.className = styles.veil!;
      const band = document.createElement("span");
      band.className = sheenBandClass;
      veil.append(band);
      layer.append(veil);
      this.els = createRimEls(layer, CARD_SPARKS);
      this.band = band;
      this.layer = layer;
    }
    if (this.layer.parentElement !== slot) {
      if (this.els) renderRim(this.els, this.box, 0, null, 0, () => 0, 0);
      for (const a of this.layer.getAnimations({ subtree: true })) a.cancel();
      slot.append(this.layer);
    }
    const r = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 30;
    this.box = { w: card.offsetWidth, h: card.offsetHeight, r };
    this.layer.style.setProperty("--rim-r", `${r}px`);
    this.layer.style.rotate = card.style.rotate;
  }

  /** The threads' frame loop: only while a card is lit, stopped once they faded out. */
  private run(): void {
    if (this.off) return;
    this.off = this.loop().subscribe((_dt, now) => {
      const els = this.els;
      const c = this.config;
      if (this.lit && hoverBlocked(this.stage, this.dragging, now - this.wheelAt)) this.leave(now);
      const h =
        this.leftAt >= 0
          ? threadLevel(now, 0, c, this.leftAt, this.leftFrom)
          : this.lit
            ? threadLevel(now, this.enterAt, c)
            : 0;
      if (els) {
        const phase = (t: number) => threadPhase(t, c.threadSpeed, c.look.reduced);
        renderRim(els, this.box, h, c.look, 0, phase, now);
      }
      if (h <= 0 && !this.lit) {
        this.leftAt = -1;
        this.stop();
      }
    }, THREAD_FPS);
  }

  private stop(): void {
    this.off?.();
    this.off = null;
  }
}

/** The selected card's own periodic veil (2b, `cardSheen`) glides at `now` (engine or CSS). */
export function periodicGlide(sheen: ElementValues | undefined) {
  return (card: HTMLElement, now: number): boolean => {
    if (sheen?.on !== true || card.parentElement?.dataset.active === undefined) return false;
    const css = card.querySelector(`.${CSS.escape(sheenBandClass)}`);
    if (css && css.getAnimations().length > 0) return true;
    return sheenAt(now, Number(sheen.duration) || 1800) >= 0;
  };
}
