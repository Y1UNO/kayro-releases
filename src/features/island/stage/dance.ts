import type { Pulse } from "./beat";
import {
  BEATS,
  feel,
  nextFigure,
  orbit,
  place,
  sun,
  type FigureKind,
  type FigureState,
} from "./figures";
import { groove } from "./groove";
import type { Metaballs } from "./metaballs";
import { clamp, lerp, spring, sv, TAU, type Box, type Sv } from "./motion";
import type { Part } from "./region";
import type { Metrics } from "./scale";
import type { Body, Drop, Look, Scene, SceneTrack } from "./scene";

/**
 * Kysland's « Dancing » (2026-11-03): the island becomes black ink, drops merged where they meet,
 * dancing with the music. The heart between two figures, then a figure at random (never one of
 * the last two), changed on the bar (and after a crash); each drop swims to its place on a
 * spring of its own, its place drifting a little (the ink never still), and answers the music
 * (`groove.ts`). Everything turns faster with the tempo and the song's energy. Arriving, the
 * falling ball bursts into the drops; leaving, they gather into a ball again for the flight
 * home. Full black (no colour). Logical px, s.
 */

interface Blob {
  x: Sv;
  y: Sv;
  r: Sv;
  k: number;
  z: number;
  pop: Sv;
  jx: Sv;
  jy: Sv;
}

/** The ball the drops burst from, or gather into (one more drop of the ink). */
interface Core {
  x: Sv;
  y: Sv;
  r: Sv;
  to: number;
}

/** The dance's size (the mass's radius) and place on a stage. */
export function danceLayout(m: Metrics): { R: number; C: { x: number; y: number } } {
  return { R: clamp(0.15 * m.U, 80, 240), C: { x: m.W / 2, y: m.yTop + 0.5 * (m.H - m.yTop) } };
}

export class Dance implements Scene {
  readonly drop: Drop;
  private readonly R: number;
  private readonly C: { x: number; y: number };
  private readonly n: number;
  private readonly k: number;
  /** The figures' room: x and y scales so that nothing leaves the stage. */
  private readonly fit: { x: number; y: number };
  private blobs: Blob[] = [];
  private buf: Float32Array;
  private fig: FigureState;
  private merged = false;
  private history: FigureKind[] = [];
  private next: FigureKind | null = null;
  private core: Core | null = null;
  private entered = false;
  private enteredAt = 0;
  private closing = false;
  private closingAt = 0;
  private t = 0;
  private playing = false;
  private energy = 0;
  private title = "";

  constructor(
    m: Metrics,
    private look: Look,
    private ink: Metaballs | null,
    private random: () => number = Math.random,
  ) {
    const { R, C } = danceLayout(m);
    [this.R, this.C] = [R, C];
    this.n = look.effects ? 24 : 16;
    this.k = 0.42 * R;
    this.fit = {
      x: clamp((m.W / 2 - 1.1 * R) / (3.2 * R), 0.3, 1),
      y: clamp((C.y - m.yTop - 1.1 * R) / (1.6 * R), 0.3, 1),
    };
    this.drop = { x: C.x, y: C.y, r: 0.55 * R };
    this.buf = new Float32Array(3 * (this.n + 1));
    this.fig = {
      kind: "heart",
      ft: 0,
      td: 0,
      P: 0.5,
      e0: 0,
      n: this.n,
      orbits: [0, 1, 2, 3].map(() => orbit(random)),
    };
  }

  enter(b: Body): void {
    const { R, n, random } = this;
    const calm = this.look.calm;
    this.core = calm
      ? null
      : { x: { x: b.x, v: b.vx }, y: { x: b.y, v: b.vy }, r: { x: b.r, v: b.vr }, to: 0.45 * R };
    // The drops burst out of the ball into the heart (calm: there already).
    const k = calm ? 1 : 0.35;
    this.blobs = Array.from({ length: n }, (_, i) => {
      const [tx, ty, tr] = place({ ...this.fig, kind: "heart" }, i);
      return {
        x: { x: b.x + tx * R * k, v: b.vx },
        y: { x: b.y + ty * R * k, v: b.vy },
        r: sv(tr * R * k),
        k: 16 + 10 * random(),
        z: 0.5 + 0.2 * random(),
        pop: { x: 0, v: calm ? 0 : 2.4 },
        jx: sv(0),
        jy: sv(0),
      };
    });
    this.switchTo("heart");
    [this.entered, this.closing, this.enteredAt] = [true, false, this.t];
  }

  track(s: SceneTrack | null): void {
    const title = s?.title ?? "";
    if (title === this.title) return;
    const fresh = this.title !== "";
    this.title = title;
    if (!fresh || !this.entered || this.look.calm) return;
    // A new song: a pop, and a new figure at the next bar.
    for (const b of this.blobs) b.pop.v += 2;
    this.next = this.fig.kind === "heart" ? nextFigure(this.history, this.random) : "heart";
  }

  private switchTo(kind: FigureKind): void {
    if (this.fig.kind !== kind) this.history = [...this.history.slice(-3), this.fig.kind];
    this.fig.kind = kind;
    this.fig.ft = 0;
    this.merged = false;
    this.next = null;
    if (kind === "satellites") this.fig.orbits = [0, 1, 2, 3].map(() => orbit(this.random));
  }

  frame(p: Pulse, playing: boolean): void {
    this.playing = playing;
    this.energy = p.energy;
    this.fig.P = clamp(p.period, 0.3, 1);
    this.fig.e0 = playing ? (p.env[0] ?? 0) : 0;
    if (!this.entered || this.closing || this.look.calm) return;
    const { fig, random } = this;
    const after = (kind: FigureKind) =>
      kind === "heart" ? nextFigure(this.history, random) : "heart";
    if (!this.next && fig.ft >= BEATS[fig.kind] * fig.P + (fig.kind === "fusion" ? 1 : 0)) {
      this.next = after(fig.kind);
    }
    // A crash often opens a new part of the song: a new figure on the next bar.
    if (p.crash && !this.next && fig.ft > 4 * fig.P) this.next = after(fig.kind);
    if (this.next && (!p.locked || (p.beat && p.bar === 0))) this.switchTo(this.next);
    if (!playing) return;
    if (fig.kind === "satellites") {
      for (const o of fig.orbits) {
        if (p.beat && random() < 0.12) o.dir *= -1;
        if (p.kick && random() < 0.3) o.sp = 0.6 + 1.6 * random();
      }
    }
    groove(this.blobs, p, fig.kind, this.R, random);
  }

  step(h: number): void {
    this.t += h;
    const { fig, R, C, random } = this;
    // The dance turns faster with the tempo and the song's energy; paused, it slows down (it
    // goes home after a moment); calm, it only turns slowly.
    const tempo = clamp(0.5 / fig.P, 0.6, 1.8) * (0.75 + 0.5 * this.energy);
    const rate = this.look.calm ? 0.35 : this.playing ? tempo : 0.25;
    fig.td += h * rate;
    fig.ft += h * (this.playing || this.look.calm ? 1 : 0.25);
    if (fig.kind === "satellites") {
      for (const o of fig.orbits) {
        o.ang += h * rate * o.sp * o.dir * (1 + 0.6 * Math.sin(fig.td * o.w2 + o.ph));
      }
    }
    if (fig.kind === "fusion" && !this.merged && fig.ft >= 7 * fig.P) {
      this.merged = true;
      for (const b of this.blobs) {
        b.pop.v += 3.5;
        b.jx.v += (random() - 0.5) * 6 * R;
        b.jy.v += (random() - 0.5) * 6 * R;
      }
    }
    const f = feel(fig.kind);
    // Bursting from the ball, they are held firmer at first.
    const boost = lerp(3, 1, clamp((this.t - this.enteredAt) / 1.8, 0, 1));
    const core = this.core;
    const drift = this.look.calm ? 0 : 0.07 * R;
    this.blobs.forEach((b, i) => {
      const [tx, ty, placed] = place(fig, i);
      let tr = placed;
      let [k, z] = [b.k * f.k * boost, f.z ?? b.z];
      // Its place drifts a little: the ink is never quite still.
      let x = C.x + tx * R * this.fit.x + drift * Math.sin(fig.td * 0.9 + i * 1.7);
      let y = C.y + ty * R * this.fit.y + drift * Math.cos(fig.td * 1.1 + i * 2.3);
      if (this.closing && core) {
        const [gx, gy] = sun(i, this.n, 0.3, fig.td);
        // Deep inside the ball (merged with it, its edge stays its own).
        [x, y, tr, k, z] = [core.x.x + gx * R * 0.75, core.y.x + gy * R * 0.75, 0.14, 70, 0.7];
      }
      spring(b.x, x, k, z, h);
      spring(b.y, y, k, z, h);
      spring(b.pop, 0, 180, 0.3, h);
      spring(b.jx, 0, 90, 0.35, h);
      spring(b.jy, 0, 90, 0.35, h);
      const e = this.closing ? 0 : 0.12 * fig.e0;
      spring(b.r, tr * R * (1 + e) * (1 + 0.25 * b.pop.x), 70, 0.4, h);
    });
    if (core) {
      spring(core.x, this.closing ? core.x.x : C.x, 36, 0.5, h);
      spring(core.y, this.closing ? core.y.x : C.y, 32, 0.42, h);
      spring(core.r, core.to, 60, this.closing ? 0.7 : 0.6, h);
      // Burst: once the drops cover it, the ball is gone.
      if (!this.closing && this.t - this.enteredAt > 1.1) this.core = null;
    }
  }

  close(): void {
    if (this.closing) return;
    [this.closing, this.closingAt] = [true, this.t];
    // Gathered where the ink is.
    let [sx, sy, sw] = [0, 0, 0];
    for (const b of this.blobs) {
      const w = b.r.x * b.r.x + 1;
      [sx, sy, sw] = [sx + (b.x.x + b.jx.x) * w, sy + (b.y.x + b.jy.x) * w, sw + w];
    }
    const [x, y] = sw > 0 ? [sx / sw, sy / sw] : [this.C.x, this.C.y];
    const r = this.core?.r.x ?? 0;
    this.core = { x: sv(x), y: sv(y), r: sv(r), to: 0.8 * this.R };
  }

  reopen(): void {
    this.closing = false;
    if (this.core) this.core.to = 0;
    this.enteredAt = this.t - 0.6;
  }

  closed(): Body | null {
    const core = this.core;
    if (!this.closing || !core) return null;
    const since = this.t - this.closingAt;
    const inside = this.blobs.every(
      (b) =>
        Math.hypot(b.x.x + b.jx.x - core.x.x, b.y.x + b.jy.x - core.y.x) + b.r.x + 0.2 * this.k <
        core.r.x,
    );
    if (!(since > 1.3 || (since > 0.5 && inside && core.r.x > 0.95 * core.to))) return null;
    return {
      x: core.x.x,
      y: core.y.x,
      r: core.r.x,
      vx: core.x.v,
      vy: core.y.v,
      vr: core.r.v,
      oval: 0,
      ovalV: 0,
      axis: 0,
    };
  }

  get busy(): boolean {
    return this.entered;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { buf, k } = this;
    const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const add = (i: number, x: number, y: number, r: number) => {
      [buf[3 * i], buf[3 * i + 1], buf[3 * i + 2]] = [x, y, r];
      const m = r + k + 3;
      [box.x0, box.y0] = [Math.min(box.x0, x - m), Math.min(box.y0, y - m)];
      [box.x1, box.y1] = [Math.max(box.x1, x + m), Math.max(box.y1, y + m)];
    };
    this.blobs.forEach((b, i) => add(i, b.x.x + b.jx.x, b.y.x + b.jy.x, Math.max(0, b.r.x)));
    // The ball they burst from or gather into is one more drop (it merges with them).
    let n = this.blobs.length;
    const core = this.core;
    if (core && core.r.x > 0.5) add(n++, core.x.x, core.y.x, core.r.x);
    if (this.ink?.draw(buf, n, k, box, ctx.globalAlpha)) return;
    // Without the graphics card: plain round drops.
    ctx.fillStyle = "#000";
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(buf[3 * i]!, buf[3 * i + 1]!, buf[3 * i + 2]!, 0, TAU);
      ctx.fill();
    }
  }

  hide(): void {
    this.ink?.clear();
  }

  slow(): void {
    this.ink?.lower();
  }

  parts(out: Part[]): void {
    const m = 0.45 * this.k + 4;
    for (const b of this.blobs) {
      const [x, y, r] = [b.x.x + b.jx.x, b.y.x + b.jy.x, Math.max(0, b.r.x) + m];
      out.push({
        x0: x - r,
        y0: y - r,
        x1: x + r,
        y1: y + r,
        vx: b.x.v + b.jx.v,
        vy: b.y.v + b.jy.v,
      });
    }
    const core = this.core;
    if (core) {
      const r = Math.max(core.r.x, core.to) + 4;
      out.push({ x0: core.x.x - r, y0: core.y.x - r, x1: core.x.x + r, y1: core.y.x + r });
    }
  }

  hits(x: number, y: number): boolean {
    const near = (cx: number, cy: number, r: number) => Math.hypot(x - cx, y - cy) < r;
    const c = this.core;
    if (c && near(c.x.x, c.y.x, c.r.x)) return true;
    return this.blobs.some((b) => near(b.x.x + b.jx.x, b.y.x + b.jy.x, b.r.x + 0.3 * this.k));
  }

  dispose(): void {
    this.ink?.dispose();
    this.ink = null;
  }
}
