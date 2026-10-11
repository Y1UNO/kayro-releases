import type { Quality } from "../../design";
import { budgetFor, dustCount, fxFps } from "../budget";
import type { LayerOptions } from "../css/cssFx";
import type { FxLayer, FxPalette, FxParams } from "../FxLayer";
import { frameLoop, type FrameLoop } from "../loop";
import { prefersReducedMotion } from "../motionPref";

/**
 * Glowing dust rising in the lower half of the screen (mock-up: 14 divs with a CSS animation).
 * One 2D canvas, a fixed pool of particles in typed arrays (no allocation per frame), a glow
 * sprite drawn once per palette, and only the rectangles touched by the previous frame cleared.
 */

/** Per particle: start x, start y (fractions of the screen), core size (px), duration (ms), phase (0–1). */
const STRIDE = 5;
/** Per particle: previous drawn rectangle x, y, side (device px). */
const RECT = 3;
const MAX = 64;
/** Mock-up `rise` keyframes: translate(28px, -190px), opacity 0 → .85 (15 %) → .5 (85 %) → 0. */
const RISE_X = 28;
const RISE_Y = -190;
/** Glow radius around the core (mock-up: box-shadow 0 0 10px). */
const GLOW = 10;
const SPRITE = 64;

/** Same pseudo-random numbers as the mock-up (stable layout, no Math.random). */
export function hash(i: number, k: number, m: number): number {
  return Math.abs(Math.sin(i * k) * m) % 1;
}

/** Fills `out` (length >= count * STRIDE) with the mock-up's particles. */
export function seedParticles(out: Float32Array, count: number): void {
  for (let i = 0; i < count; i++) {
    const a = hash(i, 12.9898, 43758.5453);
    const b = hash(i, 78.233, 12543.123);
    const c = hash(i, 39.346, 9871.77);
    const o = i * STRIDE;
    out[o] = (60 + a * 1160) / 1280;
    out[o + 1] = (380 + b * 360) / 760;
    out[o + 2] = 2 + c * 3;
    const dur = (10 + a * 9) * 1000;
    out[o + 3] = dur;
    out[o + 4] = (b * 14000) / dur; // mock-up: negative delay = already under way
  }
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** Opacity along the cycle (0–1), mock-up keyframes with ease-in-out segments. */
export function dustAlpha(p: number): number {
  if (p < 0.15) return 0.85 * ease(p / 0.15);
  if (p < 0.85) return 0.85 - 0.35 * ease((p - 0.15) / 0.7);
  return 0.5 * (1 - ease((p - 0.85) / 0.15));
}

/** Advances every phase by `dt` ms, wrapping around. Pure, allocation-free. */
export function advance(state: Float32Array, count: number, dt: number): void {
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const p = state[o + 4]! + dt / state[o + 3]!;
    state[o + 4] = p - Math.floor(p);
  }
}

export class DustLayer implements FxLayer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private sprite: HTMLCanvasElement | null = null;
  private readonly state = new Float32Array(MAX * STRIDE);
  private readonly rects = new Float32Array(MAX * RECT);
  private count = 0;
  private base = 0;
  private quality: Quality = "balanced";
  /** Art direction (step 12b): on/off and count at the reference size; null = budget's. */
  private wanted: number | null = null;
  private fps = 0;
  private alpha = 1;
  private paused = false;
  private unsubscribe: (() => void) | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private readonly onResize = () => this.resize();

  constructor(
    private readonly options: LayerOptions = {},
    private readonly loop: FrameLoop = frameLoop(),
  ) {}

  mount(host: HTMLElement): void {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    host.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    window.addEventListener("resize", this.onResize);
    this.resize();
  }

  setParams(p: FxParams): void {
    const d = p.dust;
    this.wanted = d ? (d.on === false ? 0 : Number(d.count ?? 14)) : null;
    this.setQuality(this.quality);
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    const budget = budgetFor(quality, prefersReducedMotion());
    this.base = budget.dust > 0 ? (this.wanted ?? budget.dust) : 0;
    this.fps = fxFps(budget, this.options.fps);
    this.resize();
  }

  setPalette({ beam: [r, g, b] }: FxPalette): void {
    // Mock-up (Crépuscule): core #ffe6cc and glow rgba(255,210,160,.9), i.e. the beam colour
    // mixed with white. Same mix for any palette.
    const mix = (w: number) => [r, g, b].map((c) => Math.round(c + (255 - c) * w)).join(",");
    const core = mix(0.6);
    const glow = mix(0.25);
    const sprite = this.sprite ?? document.createElement("canvas");
    sprite.width = sprite.height = SPRITE;
    const ctx = sprite.getContext("2d");
    if (!ctx) return;
    const half = SPRITE / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, `rgba(${core},1)`);
    grad.addColorStop(0.14, `rgba(${core},1)`);
    grad.addColorStop(0.24, `rgba(${glow},.75)`);
    grad.addColorStop(0.55, `rgba(${glow},.22)`);
    grad.addColorStop(1, `rgba(${glow},0)`);
    ctx.clearRect(0, 0, SPRITE, SPRITE);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SPRITE, SPRITE);
    this.sprite = sprite;
    this.start();
  }

  setIntensity(intensity: number): void {
    this.alpha = intensity;
  }

  /** The dust does not follow the selection. */
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
    window.removeEventListener("resize", this.onResize);
    this.canvas?.remove();
    this.canvas = this.ctx = this.sprite = null;
  }

  private resize(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    canvas.width = Math.round(this.w * this.dpr);
    canvas.height = Math.round(this.h * this.dpr);
    this.count = Math.min(MAX, dustCount(this.base, this.w, this.h));
    seedParticles(this.state, this.count);
    this.rects.fill(0);
    canvas.hidden = this.count === 0;
    this.stop();
    this.start();
  }

  private start(): void {
    if (this.unsubscribe || this.paused || this.count === 0 || !this.ctx) return;
    this.unsubscribe = this.loop.subscribe((dt) => this.frame(dt), this.fps);
  }

  private stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.ctx?.clearRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
    this.rects.fill(0);
  }

  private frame(dt: number): void {
    const ctx = this.ctx;
    const sprite = this.sprite;
    if (!ctx || !sprite) return;
    const { state, rects, count, dpr } = this;
    // Composition scale: the mock-up is 1280×760, enlarged with the screen height (max ×1.5).
    const k = Math.min(1.5, Math.max(1, this.h / 760)) * dpr;

    for (let i = 0; i < count; i++) {
      const o = i * RECT;
      const side = rects[o + 2]!;
      if (side > 0) ctx.clearRect(rects[o]!, rects[o + 1]!, side, side);
    }

    advance(state, count, dt);
    for (let i = 0; i < count; i++) {
      const o = i * STRIDE;
      // Typed arrays: indices are in range by construction (o < count * STRIDE <= length).
      const p = state[o + 4]!;
      const t = ease(p);
      const side = (state[o + 2]! + 2 * GLOW) * k;
      const x = state[o]! * this.w * dpr + RISE_X * k * t - side / 2;
      const y = state[o + 1]! * this.h * dpr + RISE_Y * k * t - side / 2;
      ctx.globalAlpha = dustAlpha(p) * this.alpha;
      ctx.drawImage(sprite, x, y, side, side);
      const r = i * RECT;
      rects[r] = Math.floor(x) - 1;
      rects[r + 1] = Math.floor(y) - 1;
      rects[r + 2] = Math.ceil(side) + 2;
    }
  }
}
