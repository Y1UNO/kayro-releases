import type { Body, Effects } from "./jelly";
import { clamp, rnd, Sp, TAU } from "./motion";
import type { HitKind, Music } from "./music";
import type { Rgb } from "./palette";
import { Title } from "./title";
import type { Uniforms } from "./uniforms";

/**
 * Kysland's « Disk » (the lab's Disque, 2026-11-03): the player. The cover turns in a disc of
 * black jelly, the island's matte black (glossy only if asked). The bass bumps the bubble: each kick punches its size and rings it, a
 * small shock wave leaves it; the sub makes it breathe. The snare twists it, the hi-hats ripple
 * its edge. A crash: flash, colour split, shake, two big shock waves, eight drops thrown out that
 * come back and melt into it, the title scattered. Its three strings follow the melody (the
 * user's change to the lab, 2026-11-03): smoothly lit by how much melody there is, the inner one
 * for low notes, the outer one for high ones, each new note plucking the string of its register
 * (a bump running round it both ways). The title waves on each kick. Logical px, s.
 */

/** The scenes' settings: the bass's and the crash's intensities (×0–×2). */
export interface Drive {
  bass: number;
  crash: number;
}

interface Drop {
  x: Sp;
  y: Sp;
  r0: number;
  t: number;
  ax: number;
  ay: number;
}

/** The strings' registers (of the melody's pitch, 0–1). */
const REGISTERS = [0.2, 0.5, 0.8];

export class Disc {
  spin = 0;
  readonly spinV = new Sp(3.4);
  readonly title: Title;
  private pk: { r: number; th: number; age: number; amp: number }[] = [];
  private drops: Drop[] = Array.from({ length: 8 }, () => ({
    x: new Sp(),
    y: new Sp(),
    r0: 0,
    t: 9,
    ax: 0,
    ay: 0,
  }));
  private pitch = 0.5;
  private note = 0.5;
  /** Off its place a moment (coming back from a crouch), drawn back to it. */
  private oy = new Sp(0);

  constructor(
    private W: () => number,
    private H: () => number,
    readonly body: Body,
    private M: Music,
    private fx: Effects,
    private drive: () => Drive,
    private random: () => number = Math.random,
  ) {
    this.title = new Title(H, random);
  }

  /** Its middle and its radius at rest. */
  centre(): [number, number] {
    return [this.W() / 2, this.H() * 0.43 + this.oy.x];
  }

  /** Put `dy` px off its place (it springs back). */
  nudge(dy: number): void {
    this.oy.set(dy);
  }

  radius(): number {
    return this.H() * 0.22;
  }

  private pluck(ring: number, amp: number): void {
    this.pk.push({ r: ring, th: rnd(0, TAU, this.random), age: 0, amp: amp * this.radius() });
    if (this.pk.length > 16) this.pk.shift();
  }

  private burst(g: number): void {
    const [cx, cy] = this.centre();
    const R = this.radius() * this.body.S.x;
    const H = this.H();
    const base = rnd(0, TAU, this.random);
    this.drops.forEach((d, i) => {
      const a = base + (i / 8) * TAU + rnd(-0.25, 0.25, this.random);
      const sp = H * (1.5 + rnd(0, 1.1, this.random)) * Math.min(1.6, g);
      [d.ax, d.ay] = [Math.cos(a), Math.sin(a)];
      d.x.set(cx + d.ax * R * 0.9);
      d.y.set(cy + d.ay * R * 0.9);
      d.x.v = d.ax * sp;
      d.y.v = d.ay * sp;
      d.r0 = H * rnd(0.022, 0.042, this.random);
      d.t = 0;
    });
  }

  on(ty: HitKind, v: number): void {
    const { bass, crash } = this.drive();
    const [g, gc] = [v * bass, v * crash];
    const [cx, cy] = this.centre();
    const R = this.radius() * this.body.S.x;
    const H = this.H();
    const { fx, body } = this;
    if (ty === "kick") {
      body.kick(g);
      this.spinV.v += 10 * g;
      fx.wave(cx, cy, R * 1.02, R * 1.9, 0.55, 0.55 * g, 0, H * 0.012, H * 0.003, 4 * g);
      this.title.kick(g);
    } else if (ty === "snare") {
      body.snare(v);
      this.title.snare(v);
      if (this.M.build > 0) body.S.v += 2.4 * v * this.M.build;
    } else if (ty === "hat") {
      body.hat(v);
      this.spinV.v += 1.5 * v;
    } else {
      body.crash(gc);
      this.spinV.v += 50 * gc;
      fx.crash(gc);
      fx.wave(cx, cy, R, R * 3.9, 1.2, 1.6 * gc, 0.25, H * 0.045, H * 0.006, 16 * gc);
      fx.wave(cx, cy, R, R * 2.9, 1, 0.8 * gc, 0.8, H * 0.02, H * 0.004, 6 * gc, 0.09);
      this.burst(gc);
      this.title.crash(gc);
    }
  }

  step(h: number): void {
    const { M } = this;
    const { bass } = this.drive();
    this.body.step(h, 1 + 0.035 * M.sub * bass - 0.15 * M.build - (M.gap ? 0.04 : 0));
    this.oy.to(0, 300, 0.6, h);
    this.spinV.to(M.section === "break" ? 1.8 : 3.4, 4, 1, h);
    this.spin += this.spinV.x * h;
    // The melody: its register followed smoothly; a new note plucks its string.
    this.pitch += (M.pitch - this.pitch) * (1 - Math.exp(-h / 0.15));
    if (Math.abs(M.pitch - this.note) > 0.07 && M.melody > 0.12) {
      this.note = M.pitch;
      this.pluck(this.register(M.pitch), 0.05 * clamp(M.melody, 0, 1));
    }
    for (const p of this.pk) p.age += h;
    this.pk = this.pk.filter((p) => p.age < 1.4);
    const [cx, cy] = this.centre();
    const R = this.radius() * this.body.S.x;
    for (const d of this.drops) {
      if (d.t > 3) continue;
      d.t += h;
      d.x.to(cx + d.ax * R * 0.78, 24, 0.3, h);
      d.y.to(cy + d.ay * R * 0.78, 24, 0.3, h);
    }
    this.title.step(h);
  }

  private register(p: number): number {
    let best = 0;
    REGISTERS.forEach((c, i) => {
      if (Math.abs(p - c) < Math.abs(p - REGISTERS[best]!)) best = i;
    });
    return best;
  }

  /** How strongly the melody lights string `i` (0–1). */
  private lit(i: number): number {
    const w = Math.exp(-(((this.pitch - REGISTERS[i]!) / 0.28) ** 2));
    return clamp(this.M.melody, 0, 1) * w;
  }

  fill(U: Uniforms, coverOn = 1): void {
    const [cx, cy] = this.centre();
    const R = this.radius();
    const Rs = R * this.body.S.x;
    const H = this.H();
    const { M } = this;
    this.body.fill(U, cx, cy, R);
    U.cover.set([Rs * 0.44, this.spin, coverOn, Rs * 0.035]);
    U.k = H * 0.05;
    let n = 0;
    for (const d of this.drops) {
      if (d.t > 3) continue;
      const life = d.t < 1.15 ? 1 : Math.max(0, 1 - (d.t - 1.15) / 0.35);
      const dist = Math.hypot(d.x.x - cx, d.y.x - cy) / Rs;
      const r = d.r0 * life * clamp(1.25 - 0.3 * dist, 0.45, 1.1);
      if (r < 0.4) continue;
      U.balls.set([d.x.x, d.y.x, r, 1.6], n * 4);
      n++;
    }
    U.n = n;
    const rs = Rs * (1 - 0.22 * M.build);
    const dim = M.gap ? 0.2 : 1;
    U.rings.set([
      rs * 1.24,
      (0.06 + 1.1 * this.lit(0)) * dim,
      H * 0.0024,
      0,
      rs * 1.44,
      (0.05 + 1.1 * this.lit(1)) * dim,
      H * 0.0021,
      1,
      rs * 1.64,
      (0.04 + 0.9 * this.lit(2)) * dim,
      H * 0.0018,
      2,
    ]);
    let k = 0;
    for (const p of this.pk) {
      U.pk.set([p.r, p.th, p.age, p.amp], k * 4);
      k++;
    }
    U.npk = k;
    halo(U, M, this.drive(), H);
    U.fc[0] = cx;
    U.fc[1] = cy;
  }

  /** The title under the disc. */
  overlay(ctx: CanvasRenderingContext2D, c1: Rgb, alpha: number): void {
    const { bass, crash } = this.drive();
    const glow = this.M.kick * bass + 2 * this.M.crash * crash;
    this.title.draw(ctx, this.W() / 2, this.H() * 0.875, glow, c1, alpha);
  }

  /** The title's box (under the disc). */
  titleBox(): { x0: number; y0: number; x1: number; y1: number } {
    const e = this.title.extent();
    const [W, y] = [this.W(), this.H() * 0.875];
    return { x0: W / 2 - e.half, y0: y - e.up, x1: W / 2 + e.half, y1: y + e.down };
  }

  /** The drops still out (for the region): their farthest reach from the middle. */
  reach(): number {
    const [cx, cy] = this.centre();
    let r = 0;
    for (const d of this.drops) {
      if (d.t > 3) continue;
      r = Math.max(r, Math.hypot(d.x.x - cx, d.y.x - cy) + d.r0 * 1.2);
    }
    return r;
  }
}

/** The halo, rays and rim for any scene (the lab's `haloStd`). */
export function halo(U: Uniforms, M: Music, d: Drive, H: number, base = 1): void {
  const dim = (1 - 0.72 * M.build) * (M.gap ? 0.12 : 1);
  const [b, c] = [d.bass, d.crash];
  U.halo[0] =
    ((0.1 +
      0.22 * M.sub * b +
      1.0 * M.kick * b +
      0.25 * M.snare +
      1.1 * M.crash * c +
      0.3 * M.tail * c) *
      dim +
      (M.gap ? 0 : 0.45 * M.snare * M.build)) *
    base;
  U.halo[1] = H * (0.032 + 0.05 * M.kick * b + 0.045 * M.crash * c);
  U.halo[2] = (0.45 * M.kick * b + 1.0 * M.crash * c + 0.35 * M.build * M.snare) * base * dim;
  U.halo[3] = 0.35 * M.snare + 0.9 * M.crash * c;
}
