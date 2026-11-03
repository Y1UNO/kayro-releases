import { ballPart, homeCorners, traceBall, type Corners } from "./ball";
import { dimsOf, homeBounds, homeCentre, traceHome, type Dims, type Home } from "./home";
import { clamp, eio, lerp, spring, sv, union, type Box, type Sv } from "./motion";
import type { Part } from "./region";
import type { Body, Drop } from "./scene";

/**
 * Kysland's music mode: the island leaving its place, whole (no drop hanging by a neck). It
 * squashes against the edge (wider, flatter, its shoulders drawn in), then sags like a drop
 * about to fall, lets go with a snap and falls swaying to the middle, a little disorderly,
 * stretched by its speed, wobbling, its corners rounding until it is a ball, which overshoots
 * the middle and comes back (the scene takes its body then). It is one family of shapes with
 * the way back (`ball.ts`): its first frame is the island exactly. Logical px, times in s.
 */

/** Its anticipation: squashed against the edge (u: 0–1), then sagging (v: 0–1). */
function prelude(h: Home, u: number, v: number): Dims {
  const d = dimsOf(h);
  if (v <= 0) return { w: d.w * (1 + 0.1 * u), h: d.h * (1 - 0.25 * u), s: d.s * (1 - u) };
  return { w: d.w * lerp(1.1, 0.82, v), h: d.h * lerp(0.75, 1.9, v), s: 0 };
}

export class Detach {
  /** It squashes, then sags, then lets go (s). */
  static readonly SQUASH = 0.18;
  static readonly SAG = 0.16;
  t = 0;
  private released = false;
  private round = false;
  private x: Sv;
  private y: Sv;
  private rot = sv(0);
  private m = sv(0);
  /** Its size (the mean of its half sizes) and how oval it is (half their difference). */
  private size: Sv;
  private oval = sv(0);
  private st = sv(0);
  private readonly c0: Corners;
  private readonly sway: number;
  private readonly D: number;

  constructor(
    private home: Home,
    private to: Drop,
    random: () => number = Math.random,
  ) {
    const c = homeCentre(home);
    [this.x, this.y] = [sv(c.x), sv(c.y)];
    this.size = sv((home.w + home.h) / 4);
    this.c0 = homeCorners(home);
    this.sway = random() < 0.5 ? -1 : 1;
    this.D = Math.max(40, Math.hypot(to.x - c.x, to.y - c.y));
  }

  /** Round at last (its corners all round): the scene may take its body. */
  get ready(): boolean {
    return this.round;
  }

  /** Before it lets go: how squashed (u) and how sagging (v). */
  private before(): { u: number; v: number } {
    const u = Math.sin((Math.PI / 2) * clamp(this.t / Detach.SQUASH, 0, 1));
    return { u, v: eio((this.t - Detach.SQUASH) / Detach.SAG) };
  }

  step(dt: number): void {
    this.t += dt;
    if (this.t < Detach.SQUASH + Detach.SAG) return;
    const { to, D } = this;
    if (!this.released) {
      // It lets go with a snap, a little sideways and turning.
      this.released = true;
      const d = prelude(this.home, 1, 1);
      const c = homeCentre(this.home, d);
      [this.x.x, this.y.x] = [c.x, c.y];
      [this.size.x, this.oval.x] = [(d.w + d.h) / 4, (d.w - d.h) / 4];
      this.rot.v = this.sway * 3;
      this.x.v = this.sway * 0.45 * D;
      this.y.v = 1.05 * D;
    }
    const t = this.t - Detach.SQUASH - Detach.SAG;
    const fall = clamp(t / 1, 0, 1);
    spring(this.y, to.y, 32, 0.42, dt);
    spring(this.x, to.x + this.sway * 0.18 * D * Math.sin(t * 7) * (1 - fall), 36, 0.5, dt);
    spring(this.rot, 0, 40, 0.3, dt);
    spring(this.m, 1, 55, 0.65, dt);
    // It swells into a ball with a bounce; its flatness wobbles out (a ball, not a pill).
    spring(this.size, to.r, 34, 0.38, dt);
    spring(this.oval, 0, 50, 0.45, dt);
    spring(this.st, clamp(this.y.v / (6 * D), -0.25, 0.32), 500, 0.45, dt);
    if (this.m.x >= 0.999) this.round = true;
  }

  private shape(): { A: number; B: number; c: Corners; rot: number } {
    const m = this.round ? 1 : clamp(this.m.x, 0, 1);
    const c = this.c0.map((k) => lerp(k, 1, m)) as Corners;
    const sy = 1 + this.st.x;
    const [a, b] = [this.size.x + this.oval.x, this.size.x - this.oval.x];
    return { A: a / sy, B: b * sy, c, rot: this.rot.x * 0.22 * m };
  }

  /** Its body now (for the scene it becomes). */
  body(): Body {
    const { A, B, rot } = this.shape();
    return {
      x: this.x.x,
      y: this.y.x,
      r: (A + B) / 2,
      vx: this.x.v,
      vy: this.y.v,
      vr: this.size.v,
      oval: (A - B) / 2,
      ovalV: this.oval.v,
      axis: rot,
    };
  }

  trace(ctx: CanvasRenderingContext2D | Path2D): void {
    if (!this.released) {
      const { u, v } = this.before();
      traceHome(ctx, this.home, prelude(this.home, u, v));
      return;
    }
    const { A, B, c, rot } = this.shape();
    traceBall(ctx, this.x.x, this.y.x, A, B, c, 1, 1, rot);
  }

  part(): Part {
    if (!this.released) {
      const d = dimsOf(this.home);
      return { ...homeBounds(this.home, { ...d, w: d.w * 1.1, h: d.h * 1.9 }), vx: 0, vy: 0 };
    }
    const { A, B } = this.shape();
    return ballPart(this.x.x, this.y.x, A, B, this.x.v, this.y.v);
  }

  /** The way it may take, for the window's region (from its place to the middle, swaying). */
  corridor(): Box {
    const c = homeCentre(this.home);
    const r = this.to.r * 1.6;
    const sway = 0.3 * this.D;
    return union(homeBounds(this.home), {
      x0: Math.min(c.x, this.to.x) - r - sway,
      y0: Math.min(c.y, this.to.y) - r,
      x1: Math.max(c.x, this.to.x) + r + sway,
      y1: Math.max(c.y, this.to.y) + r + 0.3 * this.D,
    });
  }
}
