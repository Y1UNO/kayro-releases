import {
  fitTitle,
  fontAt,
  LEAD,
  letter,
  stamp,
  type Letter,
  type Stamp,
  type TitleLook,
} from "./letterKit";
import { clamp, eio, spring } from "./motion";
import type { Part } from "./region";

export { TITLE_FONT, fitTitle, type TitleLook } from "./letterKit";

/**
 * Kysland's « Disk »: the song's title, in round letters of black jelly (Fredoka). The spinning
 * disc throws them one by one from its edge; each flies up, held more and more by a spring,
 * lands where it belongs and squashes. Later the disc sucks them back, holding on first: each
 * letter leans towards it and stretches, swaying, then slides in along a spiral that speeds up
 * and melts into it. Each letter is drawn once into its own little canvas (black, a faint sheen,
 * its top edges catching the light: `letterKit.ts`), then stamped: cheap every frame. Logical px.
 */

export interface TitleDeps {
  /** Resolves once the font can be drawn. */
  font: (spec: string, text: string) => Promise<unknown>;
  canvas: (w: number, h: number) => HTMLCanvasElement;
}

/** Where the title goes: the disc (its middle, radius), the stage's top. */
export interface TitleRoom {
  cx: number;
  cy: number;
  R: number;
  W: number;
  top: number;
}

export class Title {
  private L: Letter[] = [];
  private stamps = new Map<string, Stamp>();
  private size = 0;
  private t = 0;
  private live = true;
  private text = "";
  private ready = false;
  private throwAt = Infinity;
  private sucking = false;
  private fast = false;
  private landedAt = 0;
  private gulps = 0;
  private probe: CanvasRenderingContext2D | null;

  constructor(
    private room: TitleRoom,
    private look: TitleLook,
    private deps: TitleDeps,
  ) {
    this.probe = deps.canvas(4, 4).getContext("2d");
  }

  /** A new title: laid out once its font is there (until then, nothing shows). */
  set(text: string): void {
    const up = text.toLocaleUpperCase("fr");
    this.text = up;
    this.ready = false;
    this.L = [];
    this.sucking = false;
    this.dropStamps();
    const wait = new Promise((r) => window.setTimeout(r, 900));
    const font = this.deps.font(fontAt(this.room.R * 0.6), up).catch(() => null);
    void Promise.race([font, wait]).then(() => {
      if (!this.live || up !== this.text) return;
      this.layout();
      this.ready = true;
    });
  }

  /** Throws the title from the disc at `at` (s, from now on the title's clock). */
  throw(at = this.t): void {
    this.throwAt = at;
    this.sucking = false;
    for (const l of this.L) if (l.st === "wait") l.go = this.launchAt(l.i);
  }

  private launchAt(i: number): number {
    return Math.max(this.throwAt, this.t) + 0.2 + i * 0.09;
  }

  /** Sucks it back into the disc, holding on first (`fast`: a new song is waiting). */
  suck(fast = false): void {
    const { cx, cy } = this.room;
    const out = this.L.filter((l) => l.st === "fly" || l.st === "rest");
    if (!out.length) return;
    out.sort((p, q) => Math.hypot(p.tx - cx, p.ty - cy) - Math.hypot(q.tx - cx, q.ty - cy));
    out.forEach((l, k) => (l.go = this.t + k * (fast ? 0.05 : 0.13)));
    if (this.look.calm) out.forEach((l) => (l.st = "fade"));
    for (const l of this.L) if (l.st === "wait") l.st = "gone";
    [this.sucking, this.fast, this.throwAt] = [true, fast, Infinity];
  }

  /** Away at once (the island goes home): every letter fades out. */
  away(): void {
    for (const l of this.L) l.st = l.st === "wait" || l.st === "gone" ? "gone" : "fade";
    [this.sucking, this.throwAt] = [false, Infinity];
  }

  /** Letters out (flying, landed, held or being sucked). */
  get out(): boolean {
    return this.L.some((l) => l.st !== "wait" && l.st !== "gone");
  }

  /** Waiting to be thrown (asked for, letters not out yet). */
  get coming(): boolean {
    return this.throwAt < Infinity && !this.out;
  }

  /** All landed, for how long (s), or null. */
  restingFor(): number | null {
    if (!this.L.length || this.L.some((l) => l.st !== "rest")) return null;
    return this.t - this.landedAt;
  }

  /** The disc spins fast while it throws or sucks. */
  get spinning(): boolean {
    const throwing = this.L.some((l) => l.st === "wait" && l.go < Infinity);
    const recent = this.t >= this.throwAt && this.t < this.throwAt + 0.5;
    return throwing || recent || this.L.some((l) => l.st === "hold" || l.st === "suck");
  }

  /** Letters swallowed since the last look (the disc gulps each). */
  takeGulps(): number {
    const g = this.gulps;
    this.gulps = 0;
    return g;
  }

  get busy(): boolean {
    return this.L.some((l) => {
      if (l.st === "gone") return false;
      if (l.st === "wait") return l.go < Infinity;
      if (l.st !== "rest") return true;
      return Math.abs(l.jx.v) + Math.abs(l.jy.v) > 0.05 || l.alpha < 1;
    });
  }

  /** A bass hit: a landed letter wobbles. */
  kick(random: () => number = Math.random): void {
    const rest = this.L.filter((l) => l.st === "rest");
    const l = rest[Math.floor(random() * rest.length)];
    if (!l || this.look.calm) return;
    l.jx.v += 2.5;
    l.jy.v -= 2.5;
  }

  step(h: number, random: () => number = Math.random): void {
    this.t += h;
    const H = this.room.R / 0.22;
    for (const l of this.L) {
      spring(l.jx, 1, 220, 0.22, h);
      spring(l.jy, 1, 220, 0.22, h);
      if (l.st === "wait" && this.ready && this.t >= l.go) this.launch(l, H, random);
      if (l.st === "fly" || l.st === "rest" || l.st === "hold") this.fly(l, h, H);
      if (l.st === "rest" && this.look.calm) l.alpha = Math.min(1, l.alpha + h / 0.4);
      if (l.st === "rest" && this.sucking && this.t >= l.go) [l.st, l.hold] = ["hold", 0];
      if (l.st === "hold") this.hold(l, h);
      if (l.st === "suck") this.slide(l, h);
      if (l.st === "fade") {
        l.alpha -= h / (this.look.calm ? 0.4 : 0.22);
        if (l.alpha <= 0) l.st = "gone";
      }
    }
  }

  private launch(l: Letter, H: number, random: () => number): void {
    const { cx, cy, R } = this.room;
    if (this.look.calm) {
      [l.x, l.y, l.st, l.alpha] = [l.tx, l.ty, "rest", 0];
      this.landedAt = this.t;
      return;
    }
    const a = Math.PI * 0.95 + 0.2 * (random() - 0.5);
    l.x = cx + Math.cos(a) * R;
    l.y = cy + Math.sin(a) * R;
    const sp = H * 1.15 + H * 0.3 * random();
    l.vx = -Math.sin(a) * sp + H * 0.18;
    l.vy = Math.cos(a) * sp;
    l.vr = (random() - 0.5) * 14;
    [l.st, l.k, l.alpha] = ["fly", 0, 1];
    l.jx.x = l.jy.x = 0.4;
  }

  /** Thrown, then held by a spring that tightens (gravity fades as it does). */
  private fly(l: Letter, h: number, H: number): void {
    if (this.look.calm) return;
    // Held looser for longer: it flies higher, turns over, then is reeled in.
    l.k = Math.min(1, l.k + h * 1.4);
    const k = 30 + 170 * l.k;
    const c = 2 * 0.5 * Math.sqrt(k);
    const damp = 0.25 + 0.75 * l.k;
    l.vx += ((l.tx - l.x) * k * l.k - l.vx * c * damp) * h;
    l.vy += ((l.ty - l.y) * k * l.k - l.vy * c * damp + H * 0.55 * (1 - l.k)) * h;
    l.x += l.vx * h;
    l.y += l.vy * h;
    l.vr += (-l.rot * 160 - l.vr * 12) * h;
    l.rot += l.vr * h;
    if (l.st === "fly" && l.k >= 1 && Math.hypot(l.tx - l.x, l.ty - l.y) < 6) {
      l.st = "rest";
      l.jx.v += 4.5;
      l.jy.v -= 4.5;
      this.landedAt = this.t;
    }
  }

  /** Holding on: it leans towards the disc and stretches, swaying. */
  private hold(l: Letter, h: number): void {
    const { cx, cy, R } = this.room;
    l.hold += h / (this.fast ? 0.35 : 1);
    const u = eio(Math.min(1, l.hold));
    const dx = cx - l.x;
    const dy = cy - l.y;
    const dd = Math.hypot(dx, dy) || 1;
    const [ux, uy] = [dx / dd, dy / dd];
    const pull = 0.27 * R * u;
    const sway = 0.055 * R * u * Math.sin(this.t * 8 + l.i * 1.3);
    l.ox = ux * pull - uy * sway;
    l.oy = uy * pull + ux * sway;
    l.sx = 1 + 0.4 * u;
    l.ang = Math.atan2(uy, ux);
    if (l.hold >= 1) {
      const [x, y] = [l.x + l.ox, l.y + l.oy];
      [l.st, l.q, l.ox, l.oy] = ["suck", 0, 0, 0];
      l.pr0 = Math.hypot(x - cx, y - cy);
      l.pt0 = Math.atan2(y - cy, x - cx);
      [l.x, l.y, l.vx, l.vy] = [x, y, 0, 0];
    }
  }

  /** Let go: along a spiral that speeds up, shrinking, tumbling, into the disc. */
  private slide(l: Letter, h: number): void {
    const { cx, cy } = this.room;
    l.q += h / (this.fast ? 0.6 : 1.15);
    const q = Math.min(1, l.q);
    const qq = q * q;
    const pt = l.pt0 + 1.9 * qq;
    const pr = l.pr0 * (1 - qq);
    l.x = cx + Math.cos(pt) * pr;
    l.y = cy + Math.sin(pt) * pr;
    l.s = 1 - 0.95 * qq;
    // From the hold's stretch (1.4) to none, swelling on the way.
    l.sx = 1 + (0.4 + 0.6 * Math.sin(Math.PI * q)) * (1 - q);
    l.ang = pt + (Math.PI / 2) * q;
    l.rot = 0.8 * (pt - l.pt0);
    if (q >= 1) {
      l.st = "gone";
      this.gulps++;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const base = ctx.globalAlpha;
    for (const l of this.L) {
      if (l.st === "wait" || l.st === "gone" || l.alpha <= 0) continue;
      const stamp = this.stampOf(l.ch);
      if (!stamp) continue;
      ctx.save();
      ctx.globalAlpha = base * clamp(l.alpha, 0, 1);
      ctx.translate(l.x + l.ox, l.y + l.oy);
      if (l.st === "hold" || l.st === "suck") {
        ctx.rotate(l.ang);
        ctx.scale(l.sx, 1 / l.sx);
        ctx.rotate(-l.ang);
      }
      ctx.rotate(l.rot);
      const s = l.st === "suck" ? Math.max(0.05, l.s) : l.st === "fade" ? 0.85 + 0.15 * l.alpha : 1;
      ctx.scale(s * l.jx.x, s * l.jy.x);
      ctx.drawImage(stamp.c, -stamp.w / 2, -stamp.h / 2, stamp.w, stamp.h);
      ctx.restore();
    }
  }

  parts(out: Part[]): void {
    // Its stamp's half diagonal, squashed or stretched as jelly.
    const r = this.size * 1.25;
    for (const l of this.L) {
      if (l.st === "wait" || l.st === "gone") continue;
      const [x, y] = [l.x + l.ox, l.y + l.oy];
      out.push({ x0: x - r, y0: y - r, x1: x + r, y1: y + r, vx: l.vx, vy: l.vy });
    }
  }

  hits(x: number, y: number): boolean {
    const r = this.size * 0.5;
    return this.L.some((l) => l.st === "rest" && Math.abs(x - l.x) < r && Math.abs(y - l.y) < r);
  }

  dispose(): void {
    this.live = false;
    this.L = [];
    this.dropStamps();
  }

  private measure = (s: string, size: number): number => {
    if (!this.probe) return s.length * size * 0.6;
    this.probe.font = fontAt(size);
    return this.probe.measureText(s).width + Array.from(s).length * 0.06 * size;
  };

  /** Where each letter rests: the lines above the disc, the last just over it. */
  private layout(): void {
    const { cx, cy, R, W, top } = this.room;
    const { lines, size } = fitTitle(this.text, this.measure, 0.6 * R, 0.28 * R, 0.86 * W);
    // Their room above the disc: smaller if they would reach the top.
    const bottom = cy - 1.42 * R;
    const room = bottom - top - 24;
    const f = Math.max(12, Math.min(size, room / (lines.length * LEAD + 0.1)));
    this.size = f;
    const gap = 0.06 * f;
    if (this.probe) this.probe.font = fontAt(f);
    const L: Letter[] = [];
    lines.forEach((line, j) => {
      const ty = bottom - 0.35 * f - (lines.length - 1 - j) * LEAD * f;
      const chars = Array.from(line);
      const adv = chars.map((ch) => (this.probe?.measureText(ch).width ?? f * 0.6) + gap);
      let x = cx - adv.reduce((s, a) => s + a, 0) / 2;
      chars.forEach((ch, k) => {
        const w = adv[k]!;
        if (ch.trim()) L.push(letter(ch, L.length, x + w / 2, ty));
        x += w;
      });
    });
    this.L = L;
    for (const l of L) l.go = this.throwAt < Infinity ? this.launchAt(l.i) : Infinity;
  }

  private stampOf(ch: string): Stamp | null {
    const have = this.stamps.get(ch);
    if (have) return have;
    const made = stamp(ch, this.size, this.look, this.deps.canvas);
    if (made) this.stamps.set(ch, made);
    return made;
  }

  private dropStamps(): void {
    for (const s of this.stamps.values()) {
      s.c.width = 0;
      s.c.height = 0;
    }
    this.stamps.clear();
  }
}
