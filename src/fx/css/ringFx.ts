import type { Quality } from "../../design";
import { budgetFor, fxFps } from "../budget";
import type { FxLayer, FxPalette, FxParams } from "../FxLayer";
import { frameLoop, type FrameLoop } from "../loop";
import { prefersReducedMotion } from "../motionPref";
import type { LayerOptions } from "./cssFx";
import styles from "./Ring.module.css";

type Values = Readonly<Record<string, number | boolean | string>>;
const num = (v: Values | undefined, k: string, d: number) =>
  typeof v?.[k] === "number" ? (v[k] as number) : d;

/** Mask keeping only the band of the ring, `w` px wide (mock-up `G.band`). */
export function bandMask(w: number): string {
  return `radial-gradient(closest-side, transparent calc(100% - ${w}px), #000 calc(100% - ${w - 1}px), #000 calc(100% - 1px), transparent 100%)`;
}

/**
 * Crystal ring, CSS version (art direction element `crystalRing`). The reflection turns once per
 * `period` seconds, written by the frame loop (capped cadence, High / Ultra only); no pulsation.
 * `frost` > 0 adds one backdrop-filter, masked to the band.
 */
export class RingLayer implements FxLayer {
  private ring: HTMLDivElement | null = null;
  private frost: HTMLDivElement | null = null;
  private spec: HTMLDivElement | null = null;
  private v: Values | undefined;
  private quality: Quality = "balanced";
  private turning = false;
  private fps = 0;
  private paused = false;
  private time = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly options: LayerOptions = {},
    private readonly loop: FrameLoop = frameLoop(),
  ) {}

  mount(host: HTMLElement): void {
    const div = (name: string, parent: HTMLElement) => {
      const el = document.createElement("div");
      el.className = styles[name] ?? "";
      parent.appendChild(el);
      return el;
    };
    this.ring = div("ring", host);
    this.ring.dataset.ring = ""; // stays visible over the glass engine when it does not draw the ring
    this.frost = div("frost", this.ring);
    div("inner", this.ring);
    div("fringeA", this.ring);
    div("fringeB", this.ring);
    this.spec = div("spec", this.ring);
    this.apply();
  }

  setParams(p: FxParams): void {
    this.v = p.crystalRing;
    this.apply();
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    this.apply();
  }

  setPalette({ a, b }: FxPalette): void {
    const s = this.ring?.style;
    s?.setProperty("--fx-a", `rgb(${a.join(", ")})`);
    s?.setProperty("--fx-b", `rgb(${b.join(", ")})`);
  }

  setIntensity(intensity: number): void {
    this.ring?.style.setProperty("--atmosphere", String(intensity));
  }

  setFocusTarget(): void {}

  pause(): void {
    this.paused = true;
    this.stop();
  }

  resume(): void {
    this.paused = false;
    this.start();
  }

  dispose(): void {
    this.stop();
    this.ring?.remove();
    this.ring = this.frost = this.spec = null;
  }

  private apply(): void {
    const ring = this.ring;
    if (!ring) return;
    const v = this.v;
    const on = v?.on === true;
    ring.hidden = !on;
    const s = ring.style;
    const w = num(v, "band", 12);
    s.setProperty("--ring-size", `${num(v, "size", 680)}px`);
    s.setProperty("--ring-top", `${num(v, "top", -230)}px`);
    s.setProperty("--ring-x", `${num(v, "offsetX", 0)}px`);
    s.setProperty("--ring-w", `${w}px`);
    s.setProperty("--ring-band", bandMask(w));
    s.setProperty("--ring-edge", String(num(v, "edge", 0.42)));
    s.setProperty("--ring-fringe", String(num(v, "fringe", 0.5)));
    s.setProperty("--ring-glow", String(num(v, "glow", 0.18)));
    s.setProperty("--ring-spec", String(num(v, "spec", 0.9)));
    const frost = num(v, "frost", 0);
    if (this.frost) {
      this.frost.style.backdropFilter =
        on && frost > 0 ? `blur(${frost}px) saturate(170%) brightness(1.15)` : "";
    }
    const b = budgetFor(this.quality, prefersReducedMotion());
    this.turning = on && b.fog === "animated" && num(v, "spec", 0) > 0;
    this.fps = fxFps(b, this.options.fps);
    this.stop();
    if (!this.turning && this.spec) this.spec.style.transform = "";
    this.start();
  }

  private start(): void {
    if (this.unsubscribe || this.paused || !this.turning || !this.ring) return;
    this.unsubscribe = this.loop.subscribe((dt) => this.frame(dt), this.fps);
  }

  private stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private frame(dt: number): void {
    const period = num(this.v, "period", 40) * 1000;
    this.time = (this.time + dt) % period;
    if (this.spec)
      this.spec.style.transform = `rotate(${((360 * this.time) / period).toFixed(3)}deg)`;
  }
}
