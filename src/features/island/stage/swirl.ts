import { clamp, rnd, TAU } from "./motion";
import type { Uniforms } from "./uniforms";

/**
 * Kysland's music mode: the two great swirls of the bubble (2026-11-03), drawn with up to 24 more
 * balls of ink (the drops keep their 8; 32 in all), always round: chains of balls melting into
 * each other, never a spike.
 * - « Voie lactée » (from one song to the next, the user's idea): the bubble spins fast and comes
 *   apart into 3 arms wound in a spiral, which wind back in and melt into it again (1.6 s).
 * - « Supernova » (the drop, Thomas's idea): the bubble caves in, then bursts into 24 small beads;
 *   its core turns into a black hole that draws them back in a spiral and swallows them one by one,
 *   growing again with each (about 2.5 s).
 * Logical px, s.
 */

const ARMS = 3;
const PER_ARM = 8;
const BEADS = ARMS * PER_ARM;
const GALAXY_S = 1.6;

const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

interface Bead {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  in: boolean;
}

export class Swirl {
  private kind: "none" | "galaxy" | "nova" = "none";
  private t = 0;
  private turn = 0;
  private base = 0;
  private g = 1;
  private beads: Bead[] = [];
  private swallowed = 0;
  /** The core's size against its own (1 at rest), and the cover's extra turn speed (rad/s). */
  core = 1;
  spin = 0;

  constructor(private random: () => number = Math.random) {}

  get active(): boolean {
    return this.kind !== "none";
  }

  galaxy(): void {
    [this.kind, this.t, this.turn] = ["galaxy", 0, 0];
    this.base = rnd(0, TAU, this.random);
  }

  /** The drop: the burst from the bubble's edge at (`cx`, `cy`), radius `R`, as strong as `g`. */
  nova(cx: number, cy: number, R: number, H: number, g: number): void {
    [this.kind, this.t, this.g, this.swallowed] = ["nova", 0, Math.min(1.6, g), 0];
    this.beads = Array.from({ length: BEADS }, () => {
      const a = rnd(0, TAU, this.random);
      const sp = H * rnd(1.2, 2.6, this.random) * this.g;
      const side = rnd(-0.25, 0.25, this.random);
      return {
        x: cx + Math.cos(a) * R * 0.9,
        y: cy + Math.sin(a) * R * 0.9,
        vx: (Math.cos(a) - side * Math.sin(a)) * sp,
        vy: (Math.sin(a) + side * Math.cos(a)) * sp,
        r: H * rnd(0.007, 0.016, this.random),
        in: false,
      };
    });
  }

  step(h: number, cx: number, cy: number, R: number, H: number): void {
    if (this.kind === "none") return;
    this.t += h;
    if (this.kind === "galaxy") {
      const e = this.spread();
      this.core = 1 - 0.35 * e;
      this.spin = 14 * e;
      this.turn += (4 + 10 * e) * h;
      if (this.t > GALAXY_S) this.stop();
      return;
    }
    // Supernova: out for 0.5 s (slowed down), then drawn in by the black hole, spiralling.
    const t = this.t;
    const pull = t > 0.5 ? H * 9 * smooth((t - 0.5) / 0.4) : 0;
    const Rc = R * this.core;
    for (const b of this.beads) {
      if (b.in) continue;
      const [dx, dy] = [cx - b.x, cy - b.y];
      const d = Math.hypot(dx, dy) + 1e-3;
      if (pull > 0) {
        const a = (pull * Math.min(4, (R * 2) / d)) / d;
        // Inward, and a little across: a spiral.
        b.vx += (dx * a + dy * a * 0.6) * h;
        b.vy += (dy * a - dx * a * 0.6) * h;
        if (d < Rc * 0.92) {
          b.in = true;
          this.swallowed++;
        }
      }
      const drag = Math.exp(-h * (t < 0.5 ? 2.5 : 1.6));
      [b.vx, b.vy] = [b.vx * drag, b.vy * drag];
      [b.x, b.y] = [b.x + b.vx * h, b.y + b.vy * h];
    }
    // The core: caves in (0.12 s), a black hole at 55 %, growing back with each bead swallowed.
    const cave = t < 0.12 ? 1 - 0.3 * (t / 0.12) : 0.55 + 0.45 * (this.swallowed / BEADS);
    this.core = Math.min(1, cave);
    this.spin = t > 0.5 ? 6 * (1 - this.swallowed / BEADS) : 0;
    if (this.swallowed >= BEADS || t > 3.2) this.stop();
  }

  /** How far the galaxy's arms are out (0–1): out in 0.35 s, held, back in by 1.6 s. */
  private spread(): number {
    const t = this.t;
    return t < 0.35 ? smooth(t / 0.35) : t < 0.9 ? 1 : 1 - smooth((t - 0.9) / (GALAXY_S - 0.9));
  }

  private stop(): void {
    [this.kind, this.core, this.spin, this.beads] = ["none", 1, 0, []];
  }

  /** Its balls after the `n` already in `U` (32 at most); the new count. */
  fill(U: Uniforms, n: number, cx: number, cy: number, R: number): number {
    if (this.kind === "galaxy") {
      const e = this.spread();
      const Rc = R * this.core;
      for (let k = 0; k < ARMS && n < 32; k++) {
        for (let j = 0; j < PER_ARM && n < 32; j++) {
          const u = (j + 1) / PER_ARM;
          const rr = Rc * (0.75 + 1.9 * u * e);
          const th = this.base + this.turn + (k / ARMS) * TAU - (1.3 + 0.8 * (1 - e)) * u;
          const br = R * (0.34 - 0.2 * u) * (0.35 + 0.65 * e);
          U.balls.set([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, br, 1.4], n * 4);
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
    if (this.kind === "galaxy") return R * 2.2;
    let far = 0;
    for (const b of this.beads)
      if (!b.in) far = Math.max(far, Math.hypot(b.x - cx, b.y - cy) + b.r);
    return far;
  }
}
