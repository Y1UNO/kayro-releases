import type { Body, Effects } from "./jelly";
import { Moments, type Moment } from "./moments";
import { clamp, rnd, Sp, TAU } from "./motion";
import type { HitKind, Music } from "./music";
import type { Rgb } from "./palette";
import { halo } from "./halo";
import { Rumble } from "./rumble";
import { Title } from "./title";
import type { Uniforms } from "./uniforms";

/**
 * Kysland's « Disk » (the lab's Disque, 2026-11-03): the player. The cover turns in a disc of
 * black jelly, the island's matte black (glossy only if asked). The bass bumps the bubble: each
 * kick punches its size and rings it, a small shock wave leaves it; the sub makes it breathe.
 * The snare twists it, the hi-hats ripple its edge. A crash: flash, colour split, shake, two big
 * shock waves, eight drops thrown out that come back and melt into it, the title scattered. The
 * title waves on each kick. The user and Thomas's changes (2026-11-03): a smaller disc (.19 of
 * the height), its cover turning with the tempo (a turn every 8 beats) and never pushed by the
 * hits; one string per source, showing only while it plays: the sub inside, the melody, the
 * voice outside (music.rs tells them apart by the stereo). Each glows with its level, and each
 * of its notes (its level swelling; for the melody, a new pitch too) plucks it, a bump running
 * round it both ways; while its source plays it never rests. On the beat grid (the AI's,
 * grid.ts): the cover turns at its tempo, the strings brighten on each beat and ring softly on
 * each downbeat. Logical px, s.
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

/** A string: how much it shows, its source's slow level (a swell above it is a note), the time
 * since its last pluck. */
interface Strand {
  shown: number;
  slow: number;
  since: number;
}

/** The strings' radii (× the disc's) and widths (× the height): sub, melody, voice. */
const STRANDS = [
  [1.24, 0.003],
  [1.44, 0.0027],
  [1.64, 0.0024],
] as const;

export class Disc {
  spin = 0;
  readonly spinV = new Sp(1.5);
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
  private strands: Strand[] = STRANDS.map(() => ({ shown: 0, slow: 0, since: 9 }));
  private note = 0.5;
  /** Off its place a moment (coming back from a crouch), drawn back to it. */
  private oy = new Sp(0);
  /** A pulse on each beat of the grid (0–1), stronger on the downbeats; the clock's last step. */
  private beat = 0;
  private gridT = 0;
  /** The big moments besides the crash (moments.ts); the « Souffle »'s age (s) and strength. */
  readonly moments = new Moments();
  private breathT = 9;
  private breathG = 0;
  /** A big saturated bass: the bubble rumbles and sizzles (rumble.ts). */
  private rumble = new Rumble();

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
    return this.H() * 0.19;
  }

  /** A bump running round string `ring`: shaped by how sharp the notes are now (shaders.ts). */
  private pluck(ring: number, amp: number): void {
    const sh = clamp(this.M.sharp, 0, 1);
    const a = amp * (1 + 0.6 * sh) * this.radius();
    this.pk.push({ r: ring + 0.09 * sh, th: rnd(0, TAU, this.random), age: 0, amp: a });
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
      fx.wave(cx, cy, R * 1.02, R * 1.9, 0.55, 0.55 * g, 0, H * 0.012, H * 0.003, 4 * g);
      this.title.kick(g);
    } else if (ty === "snare") {
      body.snare(v);
      this.title.snare(v);
      if (this.M.build > 0) body.S.v += 2.4 * v * this.M.build;
    } else if (ty === "hat") {
      body.hat(v);
    } else {
      body.crash(gc);
      fx.crash(gc);
      fx.wave(cx, cy, R, R * 3.9, 1.2, 1.6 * gc, 0.25, H * 0.045, H * 0.006, 16 * gc);
      fx.wave(cx, cy, R, R * 2.9, 1, 0.8 * gc, 0.8, H * 0.02, H * 0.004, 6 * gc, 0.09);
      this.burst(gc);
      this.title.crash(gc);
      this.moments.crashed(this.M.t);
    }
  }

  /**
   * A big moment besides the crash, as strong as the crash's setting. « Éclosion » (a voice comes
   * in): eight drops born on the voice's string spiral in and melt into the bubble, the string
   * rings hard, a soft flash and a pale wave leave it. « Souffle » (the music settles): the bubble
   * swells slowly and lets go, one wide slow wave, drops float out and drift back, the trails
   * turn the other way.
   */
  react(m: Moment): void {
    const g = this.drive().crash;
    if (g <= 0) return;
    const [cx, cy] = this.centre();
    const R = this.radius() * this.body.S.x;
    const H = this.H();
    const free = this.drops.every((d) => d.t > 3);
    const base = rnd(0, TAU, this.random);
    if (m === "bloom") {
      this.pluck(2, 0.16 * Math.min(1.5, g));
      this.beat = 1;
      this.fx.flash = Math.max(this.fx.flash, 0.35 * Math.min(1.4, g));
      this.fx.wave(cx, cy, R * 1.64, R * 2.7, 0.9, 0.9 * g, 1, H * 0.014, H * 0.004, 4 * g);
      this.body.S.v += 1.2 * g;
      if (!free) return;
      this.drops.forEach((d, i) => {
        const a = base + (i / 8) * TAU;
        [d.ax, d.ay] = [Math.cos(a), Math.sin(a)];
        d.x.set(cx + d.ax * R * 1.64);
        d.y.set(cy + d.ay * R * 1.64);
        // Along the string (a spiral), a little inward.
        const sp = H * (0.9 + rnd(0, 0.3, this.random)) * Math.min(1.5, g);
        d.x.v = -d.ay * sp - d.ax * H * 0.2;
        d.y.v = d.ax * sp - d.ay * H * 0.2;
        d.r0 = H * rnd(0.016, 0.028, this.random);
        d.t = 0;
      });
    } else {
      [this.breathT, this.breathG] = [0, Math.min(1.5, g)];
      this.fx.wave(cx, cy, R, R * 3.2, 2.2, 1.0 * g, 0.6, H * 0.06, H * 0.005, 5 * g);
      this.M.turn = -this.M.turn;
      this.strands.forEach((s, i) => {
        if (s.shown > 0.3) this.pluck(i, 0.06);
      });
      if (!free) return;
      this.drops.forEach((d, i) => {
        if (i % 4 === 3) return;
        const a = base + (i / 8) * TAU + rnd(-0.3, 0.3, this.random);
        const sp = H * (0.45 + rnd(0, 0.3, this.random)) * Math.min(1.5, g);
        [d.ax, d.ay] = [Math.cos(a), Math.sin(a)];
        d.x.set(cx + d.ax * R * 0.9);
        d.y.set(cy + d.ay * R * 0.9);
        [d.x.v, d.y.v] = [d.ax * sp, d.ay * sp];
        d.r0 = H * rnd(0.018, 0.032, this.random);
        d.t = 0;
      });
    }
  }

  step(h: number): void {
    const { M } = this;
    const { bass } = this.drive();
    // The « Souffle »: in for 0.6 s, out over about 1.2 s.
    this.breathT += h;
    const t = this.breathT;
    const breath = this.breathG * 0.14 * (t < 0.6 ? t / 0.6 : Math.exp(-(t - 0.6) / 1.2));
    this.rumble.step(h, M, bass, this.body, this.fx, this.H(), this.random);
    const swell = 0.035 * M.sub * bass + 0.05 * this.rumble.level;
    this.body.step(h, 1 + swell - 0.15 * M.build - (M.gap ? 0.04 : 0) + breath);
    this.oy.to(0, 300, 0.6, h);
    // A turn every 8 beats: the grid's tempo once known (the AI's), else the kicks'.
    this.spinV.to(M.grid.spin() ?? (TAU * M.tempo.bpm) / 480, 1.5, 1, h);
    const on = M.grid.crossed(this.gridT, M.t);
    this.gridT = M.t;
    if (on) this.onBeat(on.down);
    const moment = this.moments.step(h, M, on?.down ?? false);
    if (moment) this.react(moment);
    this.beat *= Math.exp(-h / 0.14);
    this.spin += this.spinV.x * h;
    const levels = this.sources();
    this.strands.forEach((s, i) => {
      const v = levels[i]!;
      // It shows while its source plays (a little hysteresis), in 0.25 s, and goes in 0.8 s.
      const want = v > (s.shown > 0.5 ? 0.08 : 0.14) ? 1 : 0;
      s.shown += (want - s.shown) * (1 - Math.exp(-h / (want ? 0.25 : 0.8)));
      s.slow += (v - s.slow) * (1 - Math.exp(-h / 0.25));
      s.since += h;
      if (s.shown < 0.3 || s.since < 0.12) return;
      const note = v - s.slow > 0.06 || (i === 1 && Math.abs(M.pitch - this.note) > 0.035);
      if (note || s.since > 0.55 - 0.3 * v) {
        if (i === 1) this.note = M.pitch;
        s.since = 0;
        this.pluck(i, (note ? 0.09 : 0.05) * v);
      }
    });
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

  /**
   * A new song: its title. From one song to the next while it plays (2026-11-03, « un petit effet
   * de transition »): the bubble pinches, the cover turns once quickly (the new one fades in as it
   * loads), a soft wave leaves it and the strings ring.
   */
  song(title: string, artist: string): void {
    const next = this.title.has();
    this.title.set(title, artist);
    if (!next) return;
    const [cx, cy] = this.centre();
    const [R, H, g] = [this.radius() * this.body.S.x, this.H(), Math.min(1.5, this.drive().crash)];
    this.body.S.v -= 5 * g;
    this.spinV.x += 8;
    this.fx.wave(cx, cy, R, R * 2.4, 1.0, 0.7 * g, 0.5, H * 0.02, H * 0.004, 3 * g);
    this.strands.forEach((_, i) => this.pluck(i, 0.07));
  }

  /** A beat of the grid: the strings brighten; on a downbeat, the strings showing ring softly. */
  private onBeat(down: boolean): void {
    this.beat = Math.max(this.beat, down ? 1 : 0.45);
    if (!down) return;
    this.strands.forEach((s, i) => {
      if (s.shown > 0.5) this.pluck(i, 0.035);
    });
  }

  /** The strings' sources now (0–1): the sub (before the kick's pump), the melody, the voice. */
  private sources(): number[] {
    const { M } = this;
    return [M.subIn, M.melody, M.voice].map((v) => clamp(v, 0, 1));
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
    const levels = this.sources();
    STRANDS.forEach(([r, w], i) => {
      const [v, shown] = [levels[i]!, this.strands[i]!.shown];
      const lift = 1 + 0.6 * this.beat;
      const thick = 0.8 + 0.5 * v + (i === 0 ? 0.6 * this.rumble.level : 0);
      const glow = lift * (i === 0 ? 1 + this.rumble.crackle : 1);
      // Without its source, a string comes down onto the disc and rests on it as its outline
      // (Thomas's idea, 2026-11-03), dim; with it again, it goes back up to its place.
      const rest = 1 - shown;
      const radius = rs * (r + (1.02 - r) * rest);
      const light = (shown * (0.12 + v) * glow + 0.26 * rest) * dim;
      U.rings.set([radius, light, H * w * thick, i + 0.99 * rest], i * 4);
    });
    let k = 0;
    for (const p of this.pk) {
      U.pk.set([p.r, p.th, p.age, p.amp], k * 4);
      k++;
    }
    U.npk = k;
    halo(U, M, this.drive(), H, 1, this.rumble.level);
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
  titleBox(): { x0: number; y0: number; x1: number; y1: number } | null {
    if (!this.title.shown()) return null;
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
