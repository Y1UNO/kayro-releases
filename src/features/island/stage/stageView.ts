import { drawFallback } from "./fallback";
import { paintHome, type Home, type HomeLook } from "./home";
import { clamp, union, type Box } from "./motion";
import type { Palette } from "./palette";
import { Renderer, type Frame } from "./renderer";

/**
 * Kysland's music mode: what is drawn, and where. The WebGL passes (`renderer.ts`) under the
 * page's 2D canvas; on the 2D canvas, the island exactly as the page draws it (the first and the
 * last frames, faded against the jelly one) and the title. Without WebGL (refused or lost), the
 * ink drawn plainly in 2D. The resolution adapts: down when frames take too long, back up when
 * they are quick (or fixed by the quality setting). The 2D canvas is cleared where anything was
 * or is drawn, and wholly twice a second (nothing stale can stay). Logical px, s.
 */

export type Quality = "auto" | "low" | "medium" | "high";
const FIXED: Record<Exclude<Quality, "auto">, number> = { low: 0.5, medium: 0.75, high: 1 };
const WIPE = 0.5;

export class StageView {
  private gl: Renderer | null;
  private ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private rs = 1;
  private ema = 1 / 60;
  private emaT = 0;
  private drawn: Box | null = null;
  private wiped = -Infinity;
  /** The cover drawn square (for the fallback). */
  cover: HTMLCanvasElement | null = null;
  private coverAt = -1;

  constructor(
    private canvas: HTMLCanvasElement,
    private W: number,
    private H: number,
    private quality: Quality,
  ) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * this.dpr);
    canvas.height = Math.round(H * this.dpr);
    this.ctx = canvas.getContext("2d");
    this.gl = Renderer.under(canvas);
    this.rs = quality === "auto" ? 1 : FIXED[quality];
    this.gl?.resize(W, H, this.dpr * this.rs);
  }

  /** WebGL draws the ink and its light (else the plain 2D ink). */
  get rich(): boolean {
    return Boolean(this.gl && !this.gl.lost);
  }

  setQuality(q: Quality): void {
    if (q === this.quality) return;
    this.quality = q;
    this.rs = q === "auto" ? 1 : FIXED[q];
    this.gl?.resize(this.W, this.H, this.dpr * this.rs);
  }

  /** A frame took `raw` s: too slow, the resolution goes down; quick, it comes back. */
  pace(raw: number): void {
    if (this.quality !== "auto" || raw >= 0.2) return;
    this.ema += (raw - this.ema) * 0.05;
    this.emaT += raw;
    if (this.emaT < 1.2) return;
    this.emaT = 0;
    if (this.ema > 1 / 40 && this.rs > 0.55) this.rs *= 0.85;
    else if (this.ema < 1 / 90 && this.rs < 1) this.rs = Math.min(1, this.rs * 1.08);
    else return;
    this.gl?.resize(this.W, this.H, this.dpr * this.rs);
  }

  /** The new cover (none: hidden while it loads, the last one never shows for the next song). */
  setCover(c: HTMLCanvasElement | null): void {
    this.cover = c;
    this.coverAt = c ? performance.now() : -1;
    if (c) this.gl?.cover(c);
  }

  /** How much of the cover shows: none while it loads, then fading in (0.4 s). */
  private coverShown(): number {
    return this.coverAt < 0 ? 0 : clamp((performance.now() - this.coverAt) / 400, 0, 1);
  }

  /** The passes' frame from the scene's uniforms, the settings and the music now. */
  static frame(
    U: Frame["U"],
    pal: Palette,
    look: { gloss: number; trails: number; bass: number; crash: number },
    M: { kick: number; crash: number; tail: number; build: number; turn: number },
    lit: number,
    time: number,
    dt: number,
    box: Box,
  ): Frame {
    const { gloss, trails, bass, crash } = look;
    const { kick, tail, build, turn } = M;
    return {
      U,
      pal,
      gloss,
      trails,
      bass,
      crash,
      kick,
      crashNow: M.crash,
      tail,
      build,
      turn,
      lit,
      time,
      dt,
      box,
    };
  }

  /**
   * One frame: the passes inside `F.box`, then on the 2D canvas the island (`home.alpha`) and
   * `over` (the title) inside `box2d`.
   */
  draw(
    F: Frame,
    t: number,
    home: { h: Home; look: HomeLook; alpha: number },
    box2d: Box | null,
    over: (ctx: CanvasRenderingContext2D) => void,
  ): void {
    F.U.cover[2] = F.U.cover[2]! * this.coverShown();
    if (this.rich) this.gl!.render(F);
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const rich = this.rich;
    let box = box2d;
    if (!rich) box = box ? union(box, F.box) : F.box;
    if (!this.drawn || !box || t - this.wiped >= WIPE) {
      ctx.clearRect(0, 0, this.W, this.H);
      this.wiped = t;
    } else {
      const c = union(this.drawn, box);
      ctx.clearRect(c.x0 - 4, c.y0 - 4, c.x1 - c.x0 + 8, c.y1 - c.y0 + 8);
    }
    this.drawn = box;
    if (!rich) drawFallback(ctx, F.U, this.cover);
    if (home.alpha > 0.002) paintHome(ctx, home.h, home.look, clamp(home.alpha, 0, 1));
    over(ctx);
  }

  /** Nothing shown on either canvas. */
  clear(): void {
    this.gl?.clear();
    this.ctx?.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawn = null;
  }

  dispose(): void {
    this.gl?.dispose();
    this.gl = null;
    // The canvas as big as the screen lets its memory go until the next show.
    this.canvas.width = 0;
    this.canvas.height = 0;
    if (this.cover) {
      this.cover.width = 0;
      this.cover.height = 0;
    }
    this.cover = null;
  }
}
