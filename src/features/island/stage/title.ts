import { css, type Rgb } from "./palette";
import { clamp, rnd, Sp } from "./motion";

/**
 * Kysland's « Disk » (the lab's title): the song's title under the disc, in Fredoka, light with a
 * glow of the first colour; the artist under it, small. Each kick runs a stadium wave through it
 * (left to right, 26 ms from one letter to the next: each jumps and swells); the snare tilts it;
 * a crash throws the letters up, turning. Each letter stretches along its speed. Shown 8 s after
 * each new song, then fading out in 1.5 s (2026-11-03, the user's wish). Drawn on the
 * page's 2D canvas over the WebGL one. Logical px, s.
 */

interface Letter {
  ch: string;
  i: number;
  y: Sp;
  r: Sp;
  s: Sp;
  k: Sp;
}

const TITLE_FONT = '"Fredoka Variable", "Fredoka", "Segoe UI", system-ui, sans-serif';
const SMALL_FONT = '"Manrope Variable", "Manrope", "Segoe UI", system-ui, sans-serif';

export class Title {
  private L: Letter[] = [];
  private pend: { t: number; f: () => void }[] = [];
  private artist = "";
  private widths: number[] = [];
  private wFor = "";
  /** How long since the song came (s). */
  private age = 0;

  constructor(
    private H: () => number,
    private random: () => number = Math.random,
  ) {}

  set(title: string, artist: string): void {
    const chars = Array.from(title.trim().toLocaleUpperCase("fr")).slice(0, 48);
    this.L = chars.map((ch, i) => ({ ch, i, y: new Sp(), r: new Sp(), s: new Sp(1), k: new Sp() }));
    this.artist = artist.trim();
    this.pend = [];
    this.wFor = "";
    this.age = 0;
  }

  /** How much of it shows (1, then fading to 0 after 8 s). */
  private seen(): number {
    return clamp(1 - (this.age - 8) / 1.5, 0, 1);
  }

  /** A song's title is set. */
  has(): boolean {
    return this.L.length > 0;
  }

  /** Still showing (for the window's region). */
  shown(): boolean {
    return this.L.length > 0 && this.seen() > 0;
  }

  kick(g: number): void {
    const H = this.H();
    for (const l of this.L) {
      this.pend.push({
        t: l.i * 0.026,
        f: () => {
          l.y.v -= H * 1.3 * g;
          l.s.v += 1.6 * g;
        },
      });
    }
  }

  snare(v: number): void {
    const sg = this.random() < 0.5 ? -1 : 1;
    for (const l of this.L) l.k.v += sg * 5 * v;
  }

  crash(g: number): void {
    const H = this.H();
    for (const l of this.L) {
      l.y.v -= H * rnd(1.6, 2.8, this.random) * g;
      l.r.v += rnd(-1, 1, this.random) * 22 * g;
      l.s.v += 4 * g;
    }
  }

  step(h: number): void {
    this.age += h;
    this.pend = this.pend.filter((p) => {
      p.t -= h;
      if (p.t > 0) return true;
      p.f();
      return false;
    });
    for (const l of this.L) {
      l.y.to(0, 620, 0.3, h);
      l.r.to(0, 380, 0.26, h);
      l.s.to(1, 900, 0.28, h);
      l.k.to(0, 700, 0.3, h);
    }
  }

  /** Its height above and below its line (px), for the window's region. */
  extent(): { up: number; down: number; half: number } {
    const H = this.H();
    const lift = this.L.reduce((m, l) => Math.max(m, -l.y.x), 0);
    const half = this.widths.reduce((a, b) => a + b, 0) / 2 + H * 0.06;
    return { up: H * 0.1 + lift, down: H * 0.07, half };
  }

  /** Draws it centred on `cx`, its line at `y`, glowing by `glow` (0–1.5), at `alpha`. */
  draw(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    glow: number,
    c1: Rgb,
    alpha: number,
  ): void {
    alpha *= this.seen();
    if (!this.L.length || alpha <= 0.01) return;
    const H = this.H();
    const fs = Math.round(H * 0.072);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${fs}px ${TITLE_FONT}`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "center";
    const key = `${fs}|${this.L.map((l) => l.ch).join("")}`;
    if (key !== this.wFor) {
      const sp = fs * 0.08;
      this.widths = this.L.map((l) => ctx.measureText(l.ch).width + sp);
      this.wFor = key;
    }
    const tot = this.widths.reduce((a, b) => a + b, 0);
    let x = cx - tot / 2;
    ctx.shadowColor = css(c1, 0.9);
    ctx.shadowBlur = H * 0.012 + H * 0.04 * clamp(glow, 0, 1.5);
    ctx.fillStyle = "#f6f2ec";
    this.L.forEach((l, i) => {
      const w = this.widths[i]!;
      ctx.save();
      ctx.translate(x + w / 2, y + l.y.x);
      ctx.rotate(l.r.x);
      ctx.transform(1, 0, -l.k.x * 0.22, 1, 0, 0);
      const st = clamp(-l.y.v / (H * 14), -0.24, 0.3);
      ctx.scale(l.s.x / (1 + st), l.s.x * (1 + st));
      ctx.fillText(l.ch, 0, 0);
      ctx.restore();
      x += w;
    });
    if (this.artist) {
      ctx.shadowBlur = 0;
      ctx.font = `600 ${Math.round(H * 0.026)}px ${SMALL_FONT}`;
      ctx.fillStyle = "rgba(236,238,243,.5)";
      ctx.fillText(this.artist, cx, y + H * 0.05);
    }
    ctx.restore();
  }
}
