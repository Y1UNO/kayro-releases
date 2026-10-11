import type { Quality } from "../../design";
import { budgetFor, fxFps } from "../budget";
import type { FxLayer, FxPalette, FxParams, FxTarget } from "../FxLayer";
import { frameLoop, type FrameLoop } from "../loop";
import { prefersReducedMotion } from "../motionPref";
import styles from "./Atmosphere.module.css";
import { FOG_DRIFTS, fogTransform, swayTransform } from "./drift";

export interface LayerOptions {
  /** Cadence override (dev bench); default: the quality budget's. */
  fps?: number;
}

/**
 * CSS implementation: fog (3 radial gradients), low glow, beam and halo. Look = CSS (gradients,
 * mask, custom properties). Motion = `transform` only: the light follows the selection with a
 * 0.8 s CSS transition; the slow continuous motion (fog drift, beam sway) is written by the
 * frame loop at the budget's capped cadence, not by CSS `infinite` animations, which run at the
 * screen's rate (279 Hz here) and cost as much as everything else together (step 8 measurements).
 */
export class CssFxLayer implements FxLayer {
  private root: HTMLDivElement | null = null;
  private beamMover: HTMLDivElement | null = null;
  private haloMover: HTMLDivElement | null = null;
  private beam: HTMLDivElement | null = null;
  private fog: HTMLDivElement[] = [];
  private placed = false;
  private fogOn = false;
  private swayOn = false;
  private fps = 0;
  private paused = false;
  private quality: Quality = "balanced";
  /** Art direction switches (step 12b): which of the sketch's elements are drawn. */
  private shown = { fog: true, beam: true, floor: true, cardHalo: true };
  /** Own clock (ms): frozen while paused, so motion resumes where it stopped. */
  private time = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly options: LayerOptions = {},
    private readonly loop: FrameLoop = frameLoop(),
  ) {}

  mount(host: HTMLElement): void {
    const div = (names: string, parent: HTMLElement) => {
      const el = document.createElement("div");
      el.className = cls(names);
      parent.appendChild(el);
      return el;
    };
    const root = div("root", host);
    root.dataset.target = "none";
    root.dataset.fog = root.dataset.floor = "";
    this.fog = [div("oval a", root), div("oval b", root), div("oval c", root)];
    div("floor", root);
    const light = div("light", root);
    this.beamMover = div("mover beamMover", light);
    this.beam = div("beam", this.beamMover);
    this.haloMover = div("mover haloMover", light);
    div("halo", this.haloMover);
    this.root = root;
  }

  setParams(p: FxParams): void {
    this.shown = {
      fog: p.fog?.on !== false,
      beam: p.beam?.on !== false,
      floor: p.floor?.on !== false,
      cardHalo: p.cardHalo?.on !== false,
    };
    this.setQuality(this.quality);
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    const root = this.root;
    if (!root) return;
    const b = budgetFor(quality, prefersReducedMotion());
    const { fog, beam, floor, cardHalo } = this.shown;
    toggle(root, "beam", b.beam && beam);
    toggle(root, "halo", b.halo && cardHalo);
    toggle(root, "fog", fog);
    toggle(root, "floor", floor);
    this.fogOn = fog && b.fog === "animated";
    this.swayOn = beam && b.beam && b.sway;
    this.fps = fxFps(b, this.options.fps);
    // Back to rest for whatever stopped moving.
    if (!this.fogOn) for (const el of this.fog) el.style.transform = "";
    if (!this.swayOn && this.beam) this.beam.style.transform = "";
    this.stop();
    this.start();
  }

  setPalette({ beam: [r, g, b], fog }: FxPalette): void {
    const s = this.root?.style;
    if (!s) return;
    s.setProperty("--fx-beam", `rgb(${r}, ${g}, ${b})`);
    s.setProperty("--fx-fog-a", fog[0]);
    s.setProperty("--fx-fog-b", fog[1]);
    s.setProperty("--fx-fog-c", fog[2]);
  }

  setIntensity(intensity: number): void {
    this.root?.style.setProperty("--atmosphere", String(intensity));
  }

  setFocusTarget(target: FxTarget | null): void {
    const { root, beamMover, haloMover } = this;
    if (!root || !beamMover || !haloMover) return;
    if (!target) {
      root.dataset.target = "none";
      return;
    }
    root.dataset.target = "";
    const x = Math.round(target.x);
    const y = Math.round(target.bottom);
    const move = () => {
      beamMover.style.transform = `translate3d(${x}px, 0, 0)`;
      haloMover.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    if (this.placed) {
      move();
      return;
    }
    // First position: appear in place instead of sliding in from the corner.
    beamMover.style.transition = haloMover.style.transition = "none";
    move();
    void getComputedStyle(beamMover).transform; // flush styles while the transition is off
    void getComputedStyle(haloMover).transform;
    beamMover.style.transition = haloMover.style.transition = "";
    this.placed = true;
  }

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
    this.root = this.beamMover = this.haloMover = this.beam = null;
    this.fog = [];
    this.placed = false;
  }

  private start(): void {
    if (this.unsubscribe || this.paused || !this.root || (!this.fogOn && !this.swayOn)) return;
    this.unsubscribe = this.loop.subscribe((dt) => this.frame(dt), this.fps);
  }

  private stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private frame(dt: number): void {
    const t = (this.time += dt);
    if (this.fogOn) {
      for (let i = 0; i < FOG_DRIFTS.length; i++) {
        const el = this.fog[i];
        const d = FOG_DRIFTS[i];
        if (el && d) el.style.transform = fogTransform(d, t);
      }
    }
    if (this.swayOn && this.beam) this.beam.style.transform = swayTransform(t);
  }
}

/** Hashed class names of the CSS module, from their source names. */
export function cls(names: string): string {
  return names
    .split(" ")
    .map((n) => styles[n] ?? "")
    .join(" ");
}

function toggle(el: HTMLElement, name: string, on: boolean): void {
  if (on) el.dataset[name] = "";
  else delete el.dataset[name];
}
