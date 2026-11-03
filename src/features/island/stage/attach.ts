import { ballPart, homeCorners, traceBall, type Corners } from "./ball";
import { dimsOf, homeBounds, homeBox, homeCentre, traceHome, type Dims, type Home } from "./home";
import { clamp, lerp, smoothstep, spring, still, sv, union, type Box, type Sv } from "./motion";
import type { Part } from "./region";
import type { Body, Drop } from "./scene";

/**
 * Kysland's music mode: the island coming home. The ball crouches a moment (wider, lower), then
 * leaps up towards the middle of its place, gathering into a small drop on the way, stretched
 * by its speed; near the edge its top (and a side flush with the screen, in a corner) flattens
 * to meet it. At the touch its top stays on the edge for good (no gap can open) and it spreads
 * from there along the edge into the island, wobbling, bouncing by its bottom only, until it is
 * the island exactly. Before the touch, the music coming back turns it round. Logical px, s.
 */

/** Where a landing stands. */
export type Landing = "crouch" | "rise" | "spread" | "settled" | "back";

export class Attach {
  /** It crouches this long before it leaps (s). */
  static readonly CROUCH = 0.16;
  phase: Landing = "crouch";
  t = 0;
  /** Floating, the island's shadow and rim come in as it takes its shape (0–1). */
  look = 0;
  private x: Sv;
  private y: Sv;
  private size: Sv;
  private oval = sv(0);
  private st = sv(0);
  private flat = 0;
  private W = sv(0);
  private Hh = sv(0);
  private S = sv(0);
  /** Where the drop touched, off the island's middle: drawn back to it as it spreads. */
  private offX = sv(0);
  private offY = sv(0);
  private spreadAt = -1;
  private backTo: Drop | null = null;
  private readonly c0: Corners;
  private readonly D: number;
  private readonly from: Body;

  constructor(
    private home: Home,
    from: Body,
  ) {
    this.from = from;
    this.x = { x: from.x, v: from.vx };
    this.y = { x: from.y, v: from.vy };
    this.size = { x: from.r, v: from.vr };
    this.c0 = homeCorners(home);
    const c = homeCentre(home);
    this.D = Math.max(40, Math.hypot(from.x - c.x, from.y - c.y));
  }

  /** The small drop it gathers into before the touch (half sizes). */
  private drop(): { a: number; b: number } {
    const h = this.home.h;
    return { a: 0.75 * h, b: 0.86 * h };
  }

  /** Where the drop aims: the middle of its place (in a corner, flush with that side). */
  private aim(): { x: number; y: number } {
    const d = this.drop();
    const box = homeBox(this.home, { w: 2 * d.a, h: 2 * d.b, s: 0 });
    const y = this.home.docked ? this.home.y + d.b : homeCentre(this.home).y;
    return { x: (box.x0 + box.x1) / 2, y };
  }

  /** The music came back before the touch: it returns to `to` (false once it has touched). */
  back(to: Drop): boolean {
    if (this.phase !== "crouch" && this.phase !== "rise") return false;
    this.phase = "back";
    this.backTo = to;
    return true;
  }

  /** Back where it came from (the show goes on). */
  get returned(): boolean {
    const to = this.backTo;
    if (this.phase !== "back" || !to) return false;
    return still(this.x, to.x, 2) && still(this.y, to.y, 2) && still(this.size, to.r, 1.5);
  }

  get settled(): boolean {
    return this.phase === "settled";
  }

  step(dt: number): void {
    this.t += dt;
    const { home, from } = this;
    if (this.phase === "back" && this.backTo) {
      const to = this.backTo;
      spring(this.x, to.x, 36, 0.6, dt);
      spring(this.y, to.y, 32, 0.6, dt);
      spring(this.size, to.r, 40, 0.5, dt);
      spring(this.oval, 0, 60, 0.5, dt);
      spring(this.st, 0, 500, 0.45, dt);
      this.flat = Math.max(0, this.flat - dt * 4);
      return;
    }
    if (this.phase === "crouch") {
      // Wider and a little lower, gathering itself; then it leaps.
      spring(this.oval, 0.16 * from.r, 160, 0.55, dt);
      spring(this.y, from.y + 0.06 * from.r, 160, 0.7, dt);
      spring(this.x, from.x, 160, 0.7, dt);
      if (this.t >= Attach.CROUCH) {
        this.phase = "rise";
        this.y.v -= 0.6 * this.D;
        this.oval.v -= 2.5 * from.r;
      }
      return;
    }
    if (this.phase === "rise") {
      const d = this.drop();
      const aim = this.aim();
      // Docked, it aims past the edge: it touches it moving, never creeps up to it.
      spring(this.y, aim.y - (home.docked ? 0.6 * d.b : 0), 30, 0.72, dt);
      // Sideways it arrives first (in a corner, it touches the edge already against its side).
      spring(this.x, aim.x, 48, 0.85, dt);
      spring(this.size, (d.a + d.b) / 2, 30, 0.7, dt);
      spring(this.oval, (d.a - d.b) / 2, 40, 0.6, dt);
      spring(this.st, clamp(-this.y.v / (6 * this.D), 0, 0.3), 500, 0.45, dt);
      const { B } = this.shape();
      const top = this.y.x - B;
      if (home.docked) {
        // Nearing the edge, its top (and a flush side) flattens to meet it.
        this.flat = smoothstep(2.5 * B, 0, top - home.y);
        if (top <= home.y) this.touch();
      } else if (
        Math.hypot(this.x.x - aim.x, this.y.x - aim.y) < 0.25 * d.b &&
        Math.abs(this.y.v) < 200
      ) {
        // Floating, it settles into its place from close by (the spread draws it the rest).
        this.touch();
      }
      return;
    }
    if (this.phase === "spread") {
      const d = dimsOf(home);
      const since = this.t - this.spreadAt;
      spring(this.W, d.w, 95, 0.34, dt);
      spring(this.Hh, d.h, 130, 0.4, dt);
      spring(this.S, d.s, 90, 0.8, dt);
      spring(this.offX, 0, 120, 0.85, dt);
      spring(this.offY, 0, 120, 0.85, dt);
      this.look = home.docked ? 0 : clamp((since - 0.2) / 0.45, 0, 1);
      const done =
        still(this.W, d.w, 0.3) &&
        still(this.Hh, d.h, 0.3) &&
        still(this.S, d.s, 0.3) &&
        still(this.offX, 0, 0.3) &&
        still(this.offY, 0, 0.3);
      if (done || since > 1.8) {
        this.phase = "settled";
        this.look = home.docked ? 0 : 1;
      }
    }
  }

  private shape(): { A: number; B: number; c: Corners } {
    const sy = 1 + this.st.x;
    const c = this.c0.map((k) => lerp(1, k, this.flat)) as Corners;
    const [a, b] = [this.size.x + this.oval.x, this.size.x - this.oval.x];
    return { A: a / sy, B: b * sy, c };
  }

  /** The touch: from now on it is the island at growing sizes, its top on the edge. */
  private touch(): void {
    const { A, B } = this.shape();
    const aim = this.aim();
    this.phase = "spread";
    this.spreadAt = this.t;
    this.W = { x: 2 * A, v: 5 * this.home.w };
    if (this.home.docked) {
      // Its bottom stays where it was (its top may have crossed the edge by a step).
      this.Hh = { x: this.y.x + B - this.home.y, v: 0 };
      this.offY = sv(0);
    } else {
      this.Hh = { x: 2 * B, v: 0 };
      this.offY = { x: this.y.x - aim.y, v: this.y.v };
    }
    this.offX = { x: this.x.x - aim.x, v: this.x.v };
    this.S = sv(0);
  }

  /** Its size now while it spreads (the island's own once settled). */
  dims(): Dims {
    if (this.phase === "settled") return dimsOf(this.home);
    return { w: Math.max(4, this.W.x), h: Math.max(4, this.Hh.x), s: Math.max(0, this.S.x) };
  }

  /** The island's place while it spreads: off by where it touched; floating, kept centred. */
  private at(): Home {
    const h = this.home;
    if (this.phase === "settled") return h;
    const lift = h.docked ? 0 : (h.h - this.dims().h) / 2 + this.offY.x;
    return { ...h, x: h.x + this.offX.x, y: h.y + lift };
  }

  /** Its body (on the way back to the show). */
  body(): Body {
    const { A, B } = this.shape();
    return {
      x: this.x.x,
      y: this.y.x,
      r: (A + B) / 2,
      vx: this.x.v,
      vy: this.y.v,
      vr: this.size.v,
      oval: (A - B) / 2,
      ovalV: this.oval.v,
      axis: 0,
    };
  }

  trace(ctx: CanvasRenderingContext2D | Path2D): void {
    if (this.phase === "spread" || this.phase === "settled") {
      traceHome(ctx, this.at(), this.dims());
      return;
    }
    const { A, B, c } = this.shape();
    traceBall(ctx, this.x.x, this.y.x, A, B, c);
  }

  part(): Part {
    if (this.phase === "spread" || this.phase === "settled") {
      // As drawn, grown by where its springs take it within a moment.
      const b = homeBounds(this.at(), this.dims());
      const gx = 6 + (Math.abs(this.W.v) + Math.abs(this.offX.v)) * 0.06;
      const gy = 6 + (Math.abs(this.Hh.v) + Math.abs(this.offY.v)) * 0.06;
      return { x0: b.x0 - gx, y0: b.y0 - gy, x1: b.x1 + gx, y1: b.y1 + gy };
    }
    const { A, B } = this.shape();
    return ballPart(this.x.x, this.y.x, A, B, this.x.v, this.y.v);
  }

  /** The way back up, for the window's region. */
  corridor(): Box {
    const c = homeCentre(this.home);
    const r = this.from.r * 1.4;
    const d = dimsOf(this.home);
    return union(homeBounds(this.home, { ...d, w: d.w * 1.5, h: d.h * 1.4 }), {
      x0: Math.min(c.x, this.from.x) - r,
      y0: Math.min(c.y, this.from.y) - r,
      x1: Math.max(c.x, this.from.x) + r,
      y1: Math.max(c.y, this.from.y) + r,
    });
  }
}
