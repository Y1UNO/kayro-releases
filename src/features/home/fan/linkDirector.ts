import { Choreo } from "../../../design/motion/choreo";
import { ECO_MAX_FPS } from "../../../fx/budget";
import { liveCadence } from "../../../fx/cadenceCap";
import { setStageCue, type GlassPose, type StageFrame } from "../../../fx/gpu/cues";
import { frameLoop } from "../../../fx/loop";
import type { FanMotion, HoverConfig } from "./fanFloat";
import { put, renderFan, type FanCardEls } from "./fanRender";
import { LinkElements, type LinkEls } from "./linkEls";
import {
  deckOrder,
  restValues,
  Sequence,
  type LinkConfig,
  type LinkContext,
  type Phase,
  type SequenceKind,
  type Values,
} from "./fanTimeline";

interface Slot {
  k: number;
  slot: HTMLElement;
  card: HTMLElement;
  /** Letter / icon / name of the card (`data-face`). */
  faces: HTMLElement[];
  x: number;
  s: number;
}

const PROMOTE = "transform, opacity";
/** Centre of an element in the viewport (CSS px). */
function centre(el: HTMLElement | null): { x: number; y: number } {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
}

/** Cadence of the fan's floating and hover (decision round 3: 60 images/s, 30 in Eco). */
const FLOAT_FPS = 60;
/** Round 5: the floating alone (a slow sine) at 30 images/s; full cadence once anything else moves. */
const FLOAT_ONLY_FPS = ECO_MAX_FPS;

/**
 * Plays the category sequences on the DOM (transform / opacity written straight on the elements,
 * no React render per frame) and gives the glass engine the same poses (cues.ts). One sequence at
 * a time (one Choreo: a new one cancels the one under way and starts from where things are).
 */
export class LinkDirector {
  private readonly choreo = new Choreo();
  private values: Values = new Map();
  private phase: Phase = "spread";
  private ctx: LinkContext = { cat: 0, shuf: 0, slots: [] };
  private slots: Slot[] = [];
  private els: LinkEls | null = null;
  private fanOrigin = { x: 0, y: 0 };
  private stageOrigin = { x: 0, y: 0 };
  /** `stageOrigin` was just measured: the next render need not read it (a second forced layout). */
  private fresh = false;
  private slotBox = { w: 0, h: 0, r: 0 };
  private readonly poses = new Map<Element, GlassPose>();
  private frame: StageFrame | null = null;
  private posing = false;
  private cueOn = false;
  /** Slots handed back to the carousel's CSS at the last release (they rest at their place). */
  private restEls = new Set<HTMLElement>();
  private readonly sampler = () => this.frame;

  /** Elements registered by the components' refs. */
  private readonly elements = new LinkElements();
  /** Ref callbacks for the components (stable functions). */
  readonly bind = this.elements.bind;
  /** The fan cards on screen (none while the fan is put away). */
  private get cards(): readonly (FanCardEls | null)[] {
    return this.elements.shown();
  }
  private getEls = (): LinkEls => this.elements.get();

  constructor(private config: LinkConfig) {}

  get running(): boolean {
    return this.choreo.active;
  }

  setConfig(c: LinkConfig): void {
    this.config = c;
  }

  // ---- Floating and hover of the fan (round 3b, part B) ----
  private motion: FanMotion | null = null;
  private motionOff: (() => void) | null = null;
  private motionFps = 0;
  private eco = false;

  setMotion(m: FanMotion | null, eco: boolean, config?: HoverConfig): void {
    this.motion = m;
    if (m && config) m.config = config;
    this.eco = eco;
    this.motionOff?.();
    this.motionOff = null;
    this.wake();
  }

  /** Hover (pointer or keyboard focus) of card i; (nx, ny) = pointer over it, −1…1. */
  hover(i: number, on: boolean, nx = 0, ny = 0): void {
    const m = this.motion;
    if (!m) return;
    const now = performance.now();
    m.setHover(i, on, now);
    if (on) m.setPointer(i, nx, ny);
    if (this.motionOff && this.fpsFor(now) !== this.motionFps) this.restartMotion();
    this.wake();
  }

  /** 30 images/s while only the floating moves (no hover, no sequence), else the full cadence. */
  private fpsFor(now: number): number {
    if (this.eco) return ECO_MAX_FPS;
    return this.motion?.floatingOnly(now) && !this.choreo.active ? FLOAT_ONLY_FPS : FLOAT_FPS;
  }

  private restartMotion(): void {
    this.motionOff?.();
    this.motionOff = null;
    this.wake();
  }

  /** `hover` as a stable function (props of the fan cards). */
  readonly hoverFn = (i: number, on: boolean, nx?: number, ny?: number) =>
    this.hover(i, on, nx, ny);

  /** Nothing hovered any more (the fan is left). */
  unhover(): void {
    for (let i = 0; i < this.cards.length; i++) this.hover(i, false);
  }

  /**
   * The fan's own frame loop: only while the fan is on screen and something moves (floating,
   * hover, threads), at 60 images/s (30 in Eco, and 30 for the floating alone: round 5); stopped
   * otherwise. A running sequence draws the fan itself (same values, floating included).
   */
  wake(): void {
    if (this.motionOff || !this.motion || !this.cards.some((c) => c)) return;
    this.motionFps = this.fpsFor(performance.now());
    this.motionOff = frameLoop().subscribe((_dt, now) => {
      const m = this.motion;
      const shown = this.cards.some((c) => c);
      if (!m || !shown || !m.busy(now)) {
        this.motionOff?.();
        this.motionOff = null;
        if (shown && !this.choreo.active) this.render(this.values, this.phase);
        return;
      }
      if (!this.choreo.active) this.render(this.values, this.phase);
      if (this.fpsFor(now) !== this.motionFps) this.restartMotion();
    }, this.motionFps);
  }

  /** Shows `phase` at once (start-up, shortcut recall, reduced motion). */
  rest(phase: Phase, cat: number, shuf: number): void {
    this.choreo.cancel();
    // A sequence cut short leaves its layers promoted (title, buttons, tabs): released here.
    this.promote(false);
    this.read(cat, shuf, true);
    this.phase = phase;
    this.values = restValues(phase, this.ctx, this.config);
    this.render(this.values, phase);
    if (phase === "spread") this.release();
  }

  /** Plays a sequence from the picture of now: true at its end, false if replaced. */
  async play(
    kind: SequenceKind,
    cat: number,
    shuf: number,
    opts: { eco: boolean; reduced: boolean },
  ): Promise<boolean> {
    const seq = this.prepare(kind, cat, shuf);
    const out: Values = new Map();
    const done = await this.choreo.play(
      seq.duration,
      (t) => {
        this.values = seq.at(t, out);
        this.render(this.values, seq.phaseAt(t));
      },
      // The engine follows on the same grid (src/fx/gpu/cadence.ts, step 13).
      { ...opts, fps: liveCadence().sequence },
    );
    if (!done) return false;
    this.phase = kind === "back" ? "choose" : "spread";
    this.values = new Map(this.values);
    this.promote(false);
    if (this.phase === "spread") this.release();
    return true;
  }

  /** One moment of a sequence, still (dev captures: `/dev/home?seq=link&seek=ms`). */
  seek(kind: SequenceKind, cat: number, shuf: number, t: number): void {
    const seq = this.prepare(kind, cat, shuf);
    this.choreo.seek(t, (tt) => {
      this.values = seq.at(tt);
      this.render(this.values, seq.phaseAt(tt));
    });
  }

  /** The sequence `kind` from the current picture (the DOM React just committed). */
  private prepare(kind: SequenceKind, cat: number, shuf: number): Sequence {
    const before = this.phase;
    const known = new Set([...this.slots.map((s) => s.slot), ...this.restEls]);
    this.read(cat, shuf, true);
    const first = restValues(before, this.ctx, this.config);
    // Where each app slot starts: where the running sequence left it; at its carousel place (CSS
    // at rest); or hidden in the deck (just mounted, or coming from the fan).
    const start = new Map(this.values);
    const hidden = restValues("turn", this.ctx, this.config);
    for (const s of this.slots) {
      const was = known.has(s.slot);
      const rest = { x: s.x, y: 0, rot: 0, sc: s.s, o: 1, f: 1 };
      for (const [key, value] of Object.entries(rest)) {
        const k = `a${s.k}.${key}`;
        if (was && this.posing && start.has(k)) continue;
        start.set(k, was && before === "spread" ? value : hidden.get(k)!);
      }
    }
    this.promote(true);
    return new Sequence(kind, this.ctx, this.config, start, first);
  }

  /** Stops whatever plays and gives the engine its own measurements back. */
  dispose(): void {
    this.motionOff?.();
    this.motionOff = null;
    this.choreo.cancel();
    this.promote(false);
    this.release();
    this.cueOn = false;
    setStageCue(null);
  }

  /** Window resized: origins move, the picture is drawn again where it is. */
  relayout(): void {
    if (!this.els) return;
    this.measure();
    this.render(this.values, this.phase);
  }

  /** Measured once per sequence: the DOM of that moment (React has committed the new category). */
  private read(cat: number, shuf: number, withSlots: boolean): void {
    this.els = this.getEls();
    this.slots = [];
    const stage = this.els.stage;
    if (stage && withSlots) {
      const side = parseFloat(stage.style.getPropertyValue("--side-scale")) || 0.74;
      for (const slot of stage.querySelectorAll<HTMLElement>("[data-d]")) {
        const d = Number(slot.dataset.d);
        const card = slot.querySelector<HTMLElement>("[data-stage]");
        if (!card || Math.abs(d) > 2) continue;
        const x = parseFloat(slot.style.getPropertyValue("--x")) || 0;
        const faces = [...card.querySelectorAll<HTMLElement>("[data-face]")];
        this.slots.push({ k: d + 2, slot, card, faces, x, s: d === 0 ? 1 : side });
      }
    }
    this.ctx = { cat, shuf, slots: this.slots.map(({ k, x, s }) => ({ k, x, s })) };
    this.measure();
  }

  private measure(): void {
    const els = this.els;
    this.fanOrigin = centre(els?.fan ?? null);
    this.stageOrigin = centre(els?.stage ?? null);
    this.fresh = true;
    const s = this.slots[0];
    if (s) {
      this.slotBox = {
        w: s.slot.offsetWidth,
        h: s.slot.offsetHeight,
        r: parseFloat(getComputedStyle(s.card).borderTopLeftRadius) || 0,
      };
    }
  }

  /** Own compositor layers while a sequence runs (else each frame repaints the window). */
  private promote(on: boolean): void {
    const v = on ? PROMOTE : "";
    for (const s of this.slots) s.slot.style.willChange = v;
    const els = this.els;
    for (const el of [els?.ask, els?.title, els?.back, els?.bottom, els?.body]) {
      if (el) el.style.willChange = v;
    }
    if (els?.stage) {
      if (on) els.stage.dataset.seq = "";
      else delete els.stage.dataset.seq;
    }
  }

  /** The carousel at rest: its CSS takes over (identical values, so nothing moves). */
  private release(): void {
    for (const s of this.slots) {
      // The engine measures these cards again: their poses must go before the list is cleared
      // (left in, the glass stayed where the sequence ended while the cards moved on).
      this.poses.delete(s.card);
      const st = s.slot.style;
      st.transform = st.opacity = st.zIndex = st.willChange = "";
      s.card.style.transform = "";
      for (const f of s.faces) f.style.opacity = "";
    }
    if (this.els?.stage) delete this.els.stage.dataset.seq;
    this.restEls = new Set(this.slots.map((s) => s.slot));
    this.slots = [];
    this.posing = false;
    this.publish();
  }

  /** The fan was mounted, unmounted or put away: draw the current picture on the elements of now. */
  sync(): void {
    if (this.choreo.active) return;
    this.els = this.getEls();
    this.measure();
    this.render(this.values, this.phase);
  }

  private render(v: Values, phase: Phase): void {
    const els = this.els;
    if (!els) return;
    const g = (k: string, d = 0) => v.get(k) ?? d;
    const c = this.config;
    // The stage can move during a sequence (its layer slides in): its centre is read at every
    // posed frame (the glass never lags behind), unless just measured.
    if (this.slots.length > 0 && els.stage && !this.fresh) this.stageOrigin = centre(els.stage);
    this.fresh = false;
    this.poses.clear();
    // Category cards: turn around the pivot, lift and shrink, blur out by cross-fade; float.
    const hover = renderFan(
      els.cards,
      v,
      phase,
      this.ctx.cat,
      c,
      this.fanOrigin,
      this.motion,
      performance.now(),
      this.poses,
    );
    // Apps: stacked in the deck (shuffled order), then unfolded into the carousel.
    const spread = phase === "spread";
    for (const s of this.slots) {
      const x = g(`a${s.k}.x`, s.x);
      const y = g(`a${s.k}.y`);
      const rot = g(`a${s.k}.rot`);
      const sc = g(`a${s.k}.sc`, s.s);
      const o = g(`a${s.k}.o`, 1);
      const z = spread ? 10 - Math.abs(s.k - 2) : 10 + deckOrder(s.k, this.ctx.shuf);
      put(
        s.slot,
        "transform",
        `translate3d(${x.toFixed(2)}px, calc(-50% + ${y.toFixed(2)}px), 0) rotate(${rot.toFixed(3)}deg)`,
      );
      put(s.slot, "opacity", o.toFixed(3));
      put(s.slot, "zIndex", String(z));
      put(s.card, "transform", `scale(${sc.toFixed(4)})`);
      const face = g(`a${s.k}.f`, 1).toFixed(3);
      for (const f of s.faces) if (f.style.opacity !== face) f.style.opacity = face;
      this.poses.set(s.card, {
        x: this.stageOrigin.x + x,
        y: this.stageOrigin.y + y,
        hw: (this.slotBox.w / 2) * sc,
        hh: (this.slotBox.h / 2) * sc,
        r: this.slotBox.r * sc,
        a: (rot * Math.PI) / 180,
        soft: 0,
        z,
      });
    }
    this.posing = this.slots.length > 0;
    const set = (el: HTMLElement | null, o: number, y?: number) => {
      if (!el) return;
      put(el, "opacity", o.toFixed(3));
      if (y !== undefined) put(el, "transform", `translateY(${y.toFixed(2)}px)`);
    };
    set(els.ask, g("ask.o"), g("ask.y"));
    set(els.title, g("cat.o", 1), g("cat.y"));
    set(els.back, g("back.o", 1));
    set(els.bottom, g("tabs.o", 1));
    set(els.body, g("body.o", 1));
    this.frame = { poses: this.poses, ring: [g("ring.y"), g("ring.s", 1), g("ring.o", 1)], hover };
    this.publish();
  }

  /** The engine's cue: the poses of this frame, or nothing when the home screen rests. */
  private publish(): void {
    const resting = this.phase === "spread" && !this.choreo.active && !this.posing;
    // The carousel was released: its cards are measured again (only a fan still shown is posed).
    if (resting) for (const s of this.slots) this.poses.delete(s.card);
    const on = this.frame !== null && !(resting && this.poses.size === 0);
    if (on === this.cueOn) return;
    this.cueOn = on;
    setStageCue(on ? this.sampler : null);
  }
}
