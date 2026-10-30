import type { Quality } from "../../design";
import { budgetFor, fxFps } from "../budget";
import type { FxLayer, FxPalette, FxTarget } from "../FxLayer";
import { frameLoop, type FrameLoop } from "../loop";
import { prefersReducedMotion } from "../motionPref";
import { ATLAS_CELL, ATLAS_COLS, drawAtlas } from "./glyphAtlas";
import { MAX_MOOD_SPRITES, MOOD_KIND, MoodSim } from "./moodSim";

const SPRITE = 64;

/**
 * Steps 16–17, CSS fallback of the ambiences (the glass engine is off or failed): the same
 * simulation (moodSim.ts) drawn on one 2D canvas in additive light, one tinted sprite per shape
 * and colour (cached), the whole canvas cleared at each frame. Its loop stops with the hub.
 */
export class MoodCanvasLayer implements FxLayer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly sim = new MoodSim();
  private readonly buf = new Float32Array(MAX_MOOD_SPRITES * 8);
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private atlas: HTMLCanvasElement | null = null;
  private atlasVersion = -1;
  private palette: FxPalette | null = null;
  private quality: Quality = "balanced";
  private k = 1;
  private paused = false;
  private off: (() => void) | null = null;
  private readonly onResize = () => this.size();

  constructor(private readonly loop: FrameLoop = frameLoop()) {}

  mount(host: HTMLElement): void {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    host.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    window.addEventListener("resize", this.onResize);
    this.size();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.sim.configure(q, prefersReducedMotion());
    this.sync();
  }

  setPalette(p: FxPalette): void {
    this.palette = p;
    this.sprites.clear();
    this.sim.set(p.mood ?? null);
    this.sync();
  }

  setIntensity(k: number): void {
    this.k = k;
  }

  setFocusTarget(t: FxTarget | null): void {
    this.sim.focus = t;
  }

  setParams(): void {}

  pause(): void {
    this.paused = true;
    this.stop();
  }

  resume(): void {
    this.paused = false;
    this.sync();
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    this.canvas?.remove();
    this.canvas = this.ctx = null;
  }

  private size(): void {
    const c = this.canvas;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(window.innerWidth * dpr);
    c.height = Math.round(window.innerHeight * dpr);
  }

  /** Runs the loop while an ambience shows (one still frame with « réduire les animations »). */
  private sync(): void {
    if (this.paused || !this.canvas) return;
    if (!this.sim.active) return this.stop();
    if (!this.sim.animated) {
      this.stop();
      return this.draw();
    }
    if (this.off) return;
    const fps = fxFps(budgetFor(this.quality, false));
    this.off = this.loop.subscribe((dt) => {
      this.sim.step(dt);
      this.draw();
      if (!this.sim.active) this.stop();
    }, fps);
  }

  private stop(): void {
    this.off?.();
    this.off = null;
    this.ctx?.clearRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
  }

  private draw(): void {
    const { ctx, canvas, palette } = this;
    if (!ctx || !canvas || !palette) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = canvas.width / Math.max(1, W);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const n = this.sim.fill(this.buf, 0, MAX_MOOD_SPRITES, palette, W, H, this.k);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      const b = this.buf;
      const side = b[o + 2]! * dpr;
      ctx.globalAlpha = Math.min(1, b[o + 3]!);
      const img = this.sprite(b[o + 7]!, b[o + 4]!, b[o + 5]!, b[o + 6]!);
      if (img) ctx.drawImage(img, b[o]! * dpr - side / 2, b[o + 1]! * dpr - side / 2, side, side);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /** One sprite per shape and colour, drawn once (white shape, then tinted). */
  private sprite(kind: number, r: number, g: number, b: number): HTMLCanvasElement | null {
    const rgb = `${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}`;
    const key = `${kind}|${rgb}`;
    const hit = this.sprites.get(key);
    if (hit) return hit;
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE;
    const x = c.getContext("2d");
    if (!x) return null;
    const h = SPRITE / 2;
    if (kind >= MOOD_KIND.glyph) {
      if (this.atlasVersion !== this.sim.version) {
        this.atlas = drawAtlas(this.sim.glyphPaths);
        this.atlasVersion = this.sim.version;
      }
      const i = kind - MOOD_KIND.glyph;
      const sx = (i % ATLAS_COLS) * ATLAS_CELL;
      const sy = Math.floor(i / ATLAS_COLS) * ATLAS_CELL;
      if (this.atlas) x.drawImage(this.atlas, sx, sy, ATLAS_CELL, ATLAS_CELL, 0, 0, SPRITE, SPRITE);
    } else if (kind === MOOD_KIND.streak) {
      const grad = x.createLinearGradient(0, 0, 0, SPRITE);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, "#fff");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = grad;
      x.fillRect(h - 1.5, 0, 3, SPRITE);
    } else if (kind === MOOD_KIND.beam) {
      const grad = x.createLinearGradient(0, 0, 0, SPRITE);
      grad.addColorStop(0, "rgba(255,255,255,.5)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = grad;
      x.fillRect(h - 6, 0, 12, SPRITE);
    } else if (kind === MOOD_KIND.ring) {
      x.strokeStyle = "#fff";
      x.lineWidth = 3;
      x.beginPath();
      x.arc(h, h, h - 4, 0, Math.PI * 2);
      x.stroke();
    } else {
      const grad = x.createRadialGradient(h, h, 0, h, h, h);
      const core = kind === MOOD_KIND.soft ? 0 : 0.2;
      grad.addColorStop(0, "#fff");
      grad.addColorStop(core, "#fff");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = grad;
      x.fillRect(0, 0, SPRITE, SPRITE);
    }
    // Tint: keep the shape's alpha, take the colour.
    x.globalCompositeOperation = "source-in";
    x.fillStyle = `rgb(${rgb})`;
    x.fillRect(0, 0, SPRITE, SPRITE);
    this.sprites.set(key, c);
    return c;
  }
}
