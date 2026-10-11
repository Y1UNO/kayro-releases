import type { Quality } from "../../design";
import { budgetFor, fxFps } from "../budget";
import type { LayerOptions } from "../css/cssFx";
import type { FxLayer, FxPalette, FxParams } from "../FxLayer";
import { frameLoop, type FrameLoop } from "../loop";
import { prefersReducedMotion } from "../motionPref";
import { hash } from "./dust";

/**
 * Rising embers and twinkling stars (piste P2 « Deux lumières », art direction elements `embers`
 * and `stars`). One 2D canvas, fixed pools in typed arrays (no allocation per frame), one glow
 * sprite per kind drawn once per palette, only the rectangles touched by the previous frame
 * cleared. Counts are scaled by the quality budget; "reduce motion" keeps still stars only.
 */

export const MAX_PARTICLES = 40;
/** Per particle: x, y (fractions of the screen), size (px), period (ms), phase (0–1). */
export const STRIDE = 5;
const RECT = 3;
const SPRITE = 64;

type Values = Readonly<Record<string, number | boolean | string>>;
const num = (v: Values | undefined, k: string, d: number) =>
  typeof v?.[k] === "number" ? (v[k] as number) : d;

const ease = (t: number) => t * t * (3 - 2 * t);

/** Mock-up embers (R2-Mix-V4 `rise`): positions in the zone, sizes around `size`, lives around `life`. */
export function seedEmbers(out: Float32Array, count: number, v: Values | undefined): void {
  const x0 = num(v, "zoneX", 50) / 100 - num(v, "zoneW", 53) / 200;
  const w = num(v, "zoneW", 53) / 100;
  const top = num(v, "zoneTop", 71) / 100;
  const h = num(v, "zoneH", 26) / 100;
  const size = num(v, "size", 3.2);
  const life = num(v, "life", 9) * 1000;
  for (let i = 0; i < count; i++) {
    const a = hash(i, 21.7, 43758.5);
    const b = hash(i, 44.1, 12543.1);
    const o = i * STRIDE;
    out[o] = x0 + a * w;
    out[o + 1] = top + b * h;
    out[o + 2] = size * (0.625 + ((a * 5) % 1) * 0.75);
    out[o + 3] = life * (0.67 + a * 0.67);
    out[o + 4] = b; // already under way (mock-up: negative delays)
  }
}

/** Mock-up stars (`tw`): spread over the width, in the zone, twinkling around `twinkle` seconds. */
export function seedStars(out: Float32Array, count: number, v: Values | undefined): void {
  const top = num(v, "zoneTop", 9) / 100;
  const h = num(v, "zoneH", 34) / 100;
  const size = num(v, "size", 2.1);
  const period = num(v, "twinkle", 4.5) * 1000;
  for (let i = 0; i < count; i++) {
    const a = hash(i, 12.99, 43758.5);
    const b = hash(i, 78.23, 12543.1);
    const o = i * STRIDE;
    out[o] = (20 + a * 1240) / 1280;
    out[o + 1] = top + b * h;
    out[o + 2] = size * (0.57 + ((a * 7) % 1) * 0.86);
    out[o + 3] = period * (0.67 + a * 0.67);
    out[o + 4] = b;
  }
}

/** Ember opacity along its life (keyframes 0 → .9 at 15 % → .6 at 60 % → 0). */
export function emberAlpha(p: number): number {
  if (p < 0.15) return 0.9 * ease(p / 0.15);
  if (p < 0.6) return 0.9 - 0.3 * ease((p - 0.15) / 0.45);
  return 0.6 * (1 - ease((p - 0.6) / 0.4));
}

/** Star twinkle: 0 → 1 → 0 over the period (opacity .15 → .95, scale .6 → 1). */
export function twinkle(p: number): number {
  return ease(p < 0.5 ? p * 2 : (1 - p) * 2);
}

export function advance(state: Float32Array, count: number, dt: number): void {
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const p = state[o + 4]! + dt / state[o + 3]!;
    state[o + 4] = p - Math.floor(p);
  }
}

function rgbOf(hex: string, fallback: readonly number[]): string {
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
  }
  return fallback.join(",");
}

function sprite(canvas: HTMLCanvasElement, core: string, glow: string, coreStop: number): void {
  canvas.width = canvas.height = SPRITE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const half = SPRITE / 2;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, `rgba(${core},1)`);
  g.addColorStop(coreStop, `rgba(${core},1)`);
  g.addColorStop(Math.min(0.95, coreStop + 0.1), `rgba(${glow},.6)`);
  g.addColorStop(1, `rgba(${glow},0)`);
  ctx.clearRect(0, 0, SPRITE, SPRITE);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
}

export class ParticlesLayer implements FxLayer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly emberSprite = document.createElement("canvas");
  private readonly starSprite = document.createElement("canvas");
  private readonly embers = new Float32Array(MAX_PARTICLES * STRIDE);
  private readonly stars = new Float32Array(MAX_PARTICLES * STRIDE);
  private readonly rects = new Float32Array(2 * MAX_PARTICLES * RECT);
  private nEmbers = 0;
  private nStars = 0;
  private emberV: Values | undefined;
  private starV: Values | undefined;
  private palette: FxPalette | null = null;
  private quality: Quality = "balanced";
  private still = false;
  private fps = 0;
  private alpha = 1;
  private paused = false;
  private unsubscribe: (() => void) | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private readonly onResize = () => this.reset();

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
    this.reset();
  }

  setParams(p: FxParams): void {
    this.emberV = p.embers;
    this.starV = p.stars;
    this.paint();
    this.reset();
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    this.reset();
  }

  setPalette(palette: FxPalette): void {
    this.palette = palette;
    this.paint();
    this.reset();
  }

  setIntensity(intensity: number): void {
    this.alpha = intensity;
    if (this.still) this.drawStill();
  }

  setFocusTarget(): void {}

  pause(): void {
    this.paused = true;
    this.stop();
  }

  resume(): void {
    this.paused = false;
    this.reset();
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    this.canvas?.remove();
    this.canvas = this.ctx = null;
  }

  /** Sprites from the palette and the chosen colours ("" = theme: B for embers, A for stars). */
  private paint(): void {
    const pal = this.palette;
    if (!pal) return;
    const ember = rgbOf(String(this.emberV?.color ?? ""), pal.b);
    sprite(this.emberSprite, ember, ember, 0.18);
    const star = rgbOf(String(this.starV?.color ?? ""), [244, 241, 250]);
    sprite(this.starSprite, star, pal.a.join(","), 0.22);
  }

  private reset(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.stop();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    canvas.width = Math.round(this.w * this.dpr);
    canvas.height = Math.round(this.h * this.dpr);
    const reduced = prefersReducedMotion();
    const b = budgetFor(this.quality, reduced);
    const share = (v: Values | undefined) =>
      v?.on === true ? Math.min(MAX_PARTICLES, Math.round(num(v, "count", 0) * b.particles)) : 0;
    this.nEmbers = share(this.emberV);
    // Reduced motion: still stars only (drawn once, no loop).
    this.still = reduced;
    this.nStars = reduced
      ? Math.min(MAX_PARTICLES, this.starV?.on === true ? num(this.starV, "count", 0) : 0)
      : share(this.starV);
    seedEmbers(this.embers, this.nEmbers, this.emberV);
    seedStars(this.stars, this.nStars, this.starV);
    this.rects.fill(0);
    this.fps = fxFps(b, this.options.fps);
    canvas.hidden = this.nEmbers + this.nStars === 0;
    if (this.still) this.drawStill();
    else this.start();
  }

  private start(): void {
    if (this.unsubscribe || this.paused || this.still || !this.ctx || !this.palette) return;
    if (this.nEmbers + this.nStars === 0) return;
    this.unsubscribe = this.loop.subscribe((dt) => this.frame(dt), this.fps);
  }

  private stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.ctx?.clearRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
    this.rects.fill(0);
  }

  private drawStill(): void {
    const ctx = this.ctx;
    if (!ctx || !this.palette) return;
    ctx.clearRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
    const { stars, dpr } = this;
    for (let i = 0; i < this.nStars; i++) {
      const o = i * STRIDE;
      const side = stars[o + 2]! * 4 * dpr;
      ctx.globalAlpha = 0.6 * this.alpha;
      ctx.drawImage(
        this.starSprite,
        stars[o]! * this.w * dpr - side / 2,
        stars[o + 1]! * this.h * dpr - side / 2,
        side,
        side,
      );
    }
  }

  /** Draws one particle and remembers its rectangle (index `r` in `rects`). */
  private blit(img: HTMLCanvasElement, x: number, y: number, side: number, a: number, r: number) {
    const ctx = this.ctx!;
    ctx.globalAlpha = a * this.alpha;
    ctx.drawImage(img, x - side / 2, y - side / 2, side, side);
    const o = r * RECT;
    this.rects[o] = Math.floor(x - side / 2) - 1;
    this.rects[o + 1] = Math.floor(y - side / 2) - 1;
    this.rects[o + 2] = Math.ceil(side) + 2;
  }

  private frame(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const { rects, embers, stars, dpr, w, h } = this;
    for (let i = 0; i < rects.length; i += RECT) {
      const side = rects[i + 2]!;
      if (side > 0) ctx.clearRect(rects[i]!, rects[i + 1]!, side, side);
    }
    rects.fill(0);
    advance(embers, this.nEmbers, dt);
    advance(stars, this.nStars, dt);
    const rise = num(this.emberV, "rise", 220) * dpr;
    const glow = num(this.emberV, "glow", 8);
    for (let i = 0; i < this.nEmbers; i++) {
      const o = i * STRIDE;
      const p = embers[o + 4]!;
      const t = ease(p);
      const side = (embers[o + 2]! + 2 * glow) * dpr;
      const x = embers[o]! * w * dpr + 24 * dpr * t;
      const y = embers[o + 1]! * h * dpr - rise * t;
      this.blit(this.emberSprite, x, y, side, emberAlpha(p), i);
    }
    for (let i = 0; i < this.nStars; i++) {
      const o = i * STRIDE;
      const u = twinkle(stars[o + 4]!);
      const side = stars[o + 2]! * (0.6 + 0.4 * u) * 4 * dpr;
      const x = stars[o]! * w * dpr;
      const y = stars[o + 1]! * h * dpr;
      this.blit(this.starSprite, x, y, side, 0.15 + 0.8 * u, MAX_PARTICLES + i);
    }
  }
}
