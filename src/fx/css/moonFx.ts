import type { Quality } from "../../design";
import { budgetFor, fxFps } from "../budget";
import type { FxLayer, FxPalette, FxParams } from "../FxLayer";
import { frameLoop, type FrameLoop } from "../loop";
import { prefersReducedMotion } from "../motionPref";
import type { LayerOptions } from "./host";
import { pingPong } from "./drift";
import styles from "./Moon.module.css";

type Values = Readonly<Record<string, number | boolean | string>>;
const num = (v: Values | undefined, k: string, d: number) =>
  typeof v?.[k] === "number" ? (v[k] as number) : d;

/**
 * Moon halo and the two veils (art direction elements `moonHalo` and `veils`). The look is CSS;
 * the slow motion (moon breathing, veils swaying) is written by the shared frame loop at the
 * budget's capped cadence, and only when the budget allows continuous motion (High / Ultra).
 */
export class MoonLayer implements FxLayer {
  private root: HTMLDivElement | null = null;
  private moon: HTMLDivElement | null = null;
  private veilA: HTMLDivElement | null = null;
  private veilB: HTMLDivElement | null = null;
  private moonV: Values | undefined;
  private veilsV: Values | undefined;
  private quality: Quality = "balanced";
  private moving = false;
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
      el.className = name
        .split(" ")
        .map((n) => styles[n] ?? "")
        .join(" ");
      parent.appendChild(el);
      return el;
    };
    this.root = div("root", host);
    this.moon = div("moon", this.root);
    this.veilA = div("veil veilA", this.root);
    this.veilB = div("veil veilB", this.root);
    this.apply();
  }

  setParams(p: FxParams): void {
    this.moonV = p.moonHalo;
    this.veilsV = p.veils;
    this.apply();
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    this.apply();
  }

  setPalette({ a, b }: FxPalette): void {
    const s = this.root?.style;
    s?.setProperty("--fx-a", `rgb(${a.join(", ")})`);
    s?.setProperty("--fx-b", `rgb(${b.join(", ")})`);
  }

  setIntensity(intensity: number): void {
    this.root?.style.setProperty("--atmosphere", String(intensity));
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
    this.root?.remove();
    this.root = this.moon = this.veilA = this.veilB = null;
  }

  private apply(): void {
    const root = this.root;
    if (!root) return;
    const m = this.moonV;
    const v = this.veilsV;
    const moonOn = m?.on === true;
    const veilsOn = v?.on === true;
    toggle(root, "moon", moonOn);
    toggle(root, "veils", veilsOn);
    const s = root.style;
    s.setProperty("--moon-size", `${num(m, "size", 600)}px`);
    s.setProperty("--moon-top", `${num(m, "top", -170)}px`);
    s.setProperty("--moon-i", String(num(m, "intensity", 0.34)));
    // Same profile as the engine's moon (bgShader.ts): spread pushes and raises the knee.
    const spread = num(m, "spread", 0);
    s.setProperty("--moon-knee", `${55 + 15 * spread}%`);
    s.setProperty("--moon-knee-i", String(0.35 + 0.4 * spread));
    s.setProperty("--veil-a", String(num(v, "intensityA", 0.16)));
    s.setProperty("--veil-b", String(num(v, "intensityB", 0.14)));
    s.setProperty("--veil-top-a", `${num(v, "topA", 43)}%`);
    s.setProperty("--veil-top-b", `${num(v, "topB", 60)}%`);
    const b = budgetFor(this.quality, prefersReducedMotion());
    const breathes = moonOn && num(m, "breathe", 0) > 0;
    const sways = veilsOn && num(v, "amplitude", 0) > 0;
    this.moving = b.fog === "animated" && (breathes || sways);
    this.fps = fxFps(b, this.options.fps);
    this.stop();
    if (!this.moving) this.rest();
    this.start();
  }

  private rest(): void {
    if (this.moon) this.moon.style.transform = this.moon.style.opacity = "";
    if (this.veilA) this.veilA.style.transform = "";
    if (this.veilB) this.veilB.style.transform = "";
  }

  private start(): void {
    if (this.unsubscribe || this.paused || !this.moving || !this.root) return;
    this.unsubscribe = this.loop.subscribe((dt) => this.frame(dt), this.fps);
  }

  private stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private frame(dt: number): void {
    const t = (this.time += dt);
    const m = this.moonV;
    const v = this.veilsV;
    if (this.moon && m?.on) {
      // Mock-up `moon`: opacity .8 → 1, scale 1 → 1 + breathe, ease-in-out.
      const u = pingPong(t, num(m, "period", 9) * 1000);
      this.moon.style.opacity = (0.8 + 0.2 * u).toFixed(3);
      this.moon.style.transform = `scale(${(1 + num(m, "breathe", 0.04) * u).toFixed(4)})`;
    }
    if (v?.on) {
      // Mock-up `veilA` / `veilB`: ±amplitude px there and back, opposite directions.
      const amp = num(v, "amplitude", 80);
      const ua = pingPong(t, num(v, "periodA", 30) * 1000);
      const ub = pingPong(t, num(v, "periodB", 36) * 1000);
      if (this.veilA)
        this.veilA.style.transform = `translateX(${(-amp + 2 * amp * ua).toFixed(2)}px) rotate(-6deg)`;
      if (this.veilB)
        this.veilB.style.transform = `translateX(${(amp - 2 * amp * ub).toFixed(2)}px) rotate(5deg)`;
    }
  }
}

function toggle(el: HTMLElement, name: string, on: boolean): void {
  if (on) el.dataset[name] = "";
  else delete el.dataset[name];
}
