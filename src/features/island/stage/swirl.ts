import { clamp, rnd, Sp, TAU } from "./motion";
import type { Uniforms } from "./uniforms";

/**
 * Kysland's music mode: the two great swirls of the bubble (2026-11-03), drawn with up to 30 more
 * balls of ink (32 in all with the drops).
 * - « Voie lactée » (from one song to the next, the user's idea): the bubble spins fast and comes
 *   apart into 5 arms wound round it, each thinning to a point, out and back in on a slightly
 *   elastic spring (ink-like: the far ends trail a little), then melting into it again (≈ 1.8 s).
 * - « Supernova » (the drop, Thomas's idea): the bubble caves in, smaller and stretched, and bursts
 *   into 30 small beads that wander out at their own speeds; then each is drawn in on a tightening
 *   spiral, round the disc faster and faster, and swallowed (every one of them, staggered); the
 *   disc grows back with each (≈ 2.8 s).
 * Logical px, s.
 */

const ARMS = 5;
const PER_ARM = 6;
const BEADS = 30;
/** The Supernova's beads wander out this long (s, plus each one's delay) before being pulled. */
const OUT_S = 0.6;

interface Bead {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Its spiral in, round the centre: from how far, its angle, how fast it turned first. */
  r0: number;
  th: number;
  w0: number;
  /** When its spiral starts (after OUT_S) and how long it lasts (s). */
  delay: number;
  dur: number;
  in: boolean;
}

export class Swirl {
  private kind: "none" | "galaxy" | "nova" = "none";
  private t = 0;
  private turn = 0;
  private base = 0;
  private spread = new Sp(0);
  private beads: Bead[] = [];
  private swallowed = 0;
  /** The core's size against its own (1 at rest), the cover's extra turn speed (rad/s). */
  core = 1;
  spin = 0;
  /** The vortex's pull on the bubble's shape (its oval, 0–0.06) and where it points (rad). */
  tide = 0;
  vortex = 0;

  constructor(private random: () => number = Math.random) {}

  get active(): boolean {
    return this.kind !== "none";
  }

  galaxy(): void {
    [this.kind, this.t, this.turn] = ["galaxy", 0, 0];
    this.spread.set(0);
    this.spread.v = 0;
    this.base = rnd(0, TAU, this.random);
  }

  /** The drop: the burst from the bubble's edge at (`cx`, `cy`), radius `R`, as strong as `g`. */
  nova(cx: number, cy: number, R: number, H: number, g: number): void {
    [this.kind, this.t, this.swallowed] = ["nova", 0, 0];
    const k = Math.min(1.6, g);
    this.beads = Array.from({ length: BEADS }, () => {
      const a = rnd(0, TAU, this.random);
      const sp = H * rnd(0.5, 2.2, this.random) * k;
      const side = rnd(-0.4, 0.4, this.random);
      const bead: Bead = {
        x: cx + Math.cos(a) * R * 0.85,
        y: cy + Math.sin(a) * R * 0.85,
        vx: (Math.cos(a) - side * Math.sin(a)) * sp,
        vy: (Math.sin(a) + side * Math.cos(a)) * sp,
        r: H * rnd(0.006, 0.015, this.random),
        r0: R,
        th: a,
        w0: 1.2,
        delay: rnd(0, 0.5, this.random),
        dur: rnd(1.1, 1.7, this.random),
        in: false,
      };
      return bead;
    });
  }

  step(h: number, cx: number, cy: number, R: number): void {
    if (this.kind === "none") return;
    this.t += h;
    if (this.kind === "galaxy") this.stepGalaxy(h);
    else this.stepNova(h, cx, cy, R);
  }

  private stepGalaxy(h: number): void {
    // Out, held, back in: a spring just under critical damping (a hint of ink's give).
    this.spread.to(this.t < 0.75 ? 1 : 0, 70, 0.62, h);
    const e = clamp(this.spread.x, 0, 1.1);
    this.core = 1 - 0.3 * e;
    this.spin = 14 * e;
    this.turn += (4 + 10 * e) * h;
    const still = Math.abs(this.spread.x) < 0.01 && Math.abs(this.spread.v) < 0.05;
    if (this.t > 1.2 && still) this.stop();
  }

  private stepNova(h: number, cx: number, cy: number, R: number): void {
    const t = this.t;
    for (const b of this.beads) {
      if (b.in) continue;
      if (t < OUT_S + b.delay) {
        // Out: each at its own speed, slowing down, wandering.
        const drag = Math.exp(-h * 2.4);
        [b.vx, b.vy] = [b.vx * drag, b.vy * drag];
        [b.x, b.y] = [b.x + b.vx * h, b.y + b.vy * h];
        [b.r0, b.th] = [Math.hypot(b.x - cx, b.y - cy), Math.atan2(b.y - cy, b.x - cx)];
        // How it turns round the centre as it goes (at least slowly), all the same way.
        const across = ((b.x - cx) * b.vy - (b.y - cy) * b.vx) / Math.max(1, b.r0 * b.r0);
        b.w0 = Math.max(1.2, Math.abs(across));
        continue;
      }
      // In: a tightening spiral, faster and faster as it comes close, swallowed at the edge.
      const s = clamp((t - OUT_S - b.delay) / b.dur, 0, 1);
      const edge = R * this.core * 0.9;
      const r = edge + (b.r0 - edge) * (1 - s) * (1 - s);
      b.th += Math.min(16, b.w0 * Math.pow(b.r0 / Math.max(r, 1), 1.3)) * h;
      [b.x, b.y] = [cx + Math.cos(b.th) * r, cy + Math.sin(b.th) * r];
      if (s >= 1) {
        b.in = true;
        this.swallowed++;
      }
    }
    // The core caves in (0.12 s) to a black hole at 45 %, growing back with each bead swallowed;
    // the vortex stretches it into a turning oval while it pulls.
    const eaten = this.swallowed / BEADS;
    this.core = t < 0.12 ? 1 - 0.55 * (t / 0.12) : 0.45 + 0.55 * eaten;
    const pulling = t > OUT_S ? 1 - eaten : 0;
    this.spin = 7 * pulling;
    this.tide = 0.06 * pulling;
    this.vortex += (3 + 6 * eaten) * h;
    if (this.swallowed >= BEADS) this.stop();
  }

  private stop(): void {
    [this.kind, this.core, this.spin, this.tide, this.beads] = ["none", 1, 0, 0, []];
  }

  /** Its balls after the `n` already in `U` (32 at most); the new count. */
  fill(U: Uniforms, n: number, cx: number, cy: number, R: number): number {
    if (this.kind === "galaxy") {
      const e = clamp(this.spread.x, 0, 1.1);
      const Rc = R * this.core;
      // The far ends trail behind as the arms come out or go in (the spring's speed).
      const trail = 0.05 * this.spread.v;
      for (let k = 0; k < ARMS && n < 32; k++) {
        for (let j = 0; j < PER_ARM && n < 32; j++) {
          const u = (j + 1) / PER_ARM;
          // Wound round the bubble, thinning to a point.
          // The last balls closer together: the arm stays whole to its point.
          const rr = Rc * (0.85 + 1.5 * Math.pow(u, 0.85) * e);
          const wind = (1.5 + 0.6 * (1 - e)) * u + trail * u;
          const th = this.base + this.turn + (k / ARMS) * TAU - wind;
          const br = R * (0.24 * Math.pow(1 - u, 0.8) + 0.05) * (0.4 + 0.6 * Math.min(1, e));
          U.balls.set([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, br, 1.8], n * 4);
          n++;
        }
      }
    } else if (this.kind === "nova") {
      for (const b of this.beads) {
        if (b.in || n >= 32) continue;
        U.balls.set([b.x, b.y, b.r, 0.7], n * 4);
        n++;
      }
    }
    return n;
  }

  /** The farthest any ball is from (`cx`, `cy`), for the window's region; 0 when still. */
  reach(cx: number, cy: number, R: number): number {
    if (this.kind === "galaxy") return R * 2;
    let far = 0;
    for (const b of this.beads) {
      if (!b.in) far = Math.max(far, Math.hypot(b.x - cx, b.y - cy) + b.r);
    }
    return far;
  }
}
