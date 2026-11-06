import { lerp, rnd, Sp, TAU } from "./motion";
import type { Uniforms } from "./uniforms";

/**
 * Kysland's music mode (the lab): the jelly body shared by the island's ball and the disc, and
 * the effects shared by the scenes. Each sound has its own gesture, never the same (SPEC §1):
 * the kick punches the size (`S`: +12–13 % at once, a contraction, a rebound), a shape mode of
 * 2 or 3 lobes rings; the snare twists it (shear) and rings a mode of 4 or 5; the hi-hat only
 * ripples its edge (16 lobes); a crash rings everything. Impulses change the springs' position
 * and speed directly: the peak comes one or two frames after the sound. Effects: shock waves,
 * the crash's flash, colour split and shake. Logical px, s.
 */

interface Mode {
  n: number;
  a: Sp;
  ph: number;
  k: number;
}

export class Body {
  readonly S = new Sp(1);
  readonly m: Mode[];
  readonly shx = new Sp(0);
  rip = 0;
  ripPh = 0;

  constructor(private random: () => number = Math.random) {
    this.m = [2, 3, 4, 5].map((n) => ({
      n,
      a: new Sp(0),
      ph: rnd(0, TAU, random),
      k: 900 + 200 * n,
    }));
  }

  /** A kick of strength `g` (its strength × the bass setting); `idx`: which modes it may ring. */
  kick(g: number, idx: readonly number[] = [0, 1]): void {
    this.S.x += 0.045 * g;
    this.S.v += 4.6 * g;
    const md = this.m[idx[Math.floor(this.random() * idx.length)]!]!;
    md.ph = rnd(0, TAU, this.random);
    md.a.v += 0.085 * g * Math.sqrt(md.k);
  }

  snare(v: number): void {
    this.shx.v += (this.random() < 0.5 ? -1 : 1) * 4.2 * v;
    const md = this.m[2 + Math.floor(this.random() * 2)]!;
    md.ph = rnd(0, TAU, this.random);
    md.a.v += 0.035 * v * Math.sqrt(md.k);
  }

  hat(v: number): void {
    this.rip = Math.max(this.rip, 0.014 * v);
  }

  crash(g: number): void {
    this.S.v += 10 * g;
    for (const md of this.m) {
      md.ph = rnd(0, TAU, this.random);
      md.a.v += 0.06 * g * Math.sqrt(md.k);
    }
    this.shx.v += (this.random() < 0.5 ? -1 : 1) * 3 * g;
  }

  /** `h` s later, its size pulled towards `tS`. */
  step(h: number, tS: number): void {
    this.S.to(tS, 1300, 0.22, h);
    for (const md of this.m) md.a.to(0, md.k, 0.11, h);
    this.m[0]!.ph += h * 0.3;
    this.shx.to(0, 1300, 0.18, h);
    this.rip *= Math.exp(-h / 0.09);
    this.ripPh += h * 24;
  }

  /** Its shape for the shader: the core at (cx, cy), radius `R` before its punch. */
  fill(U: Uniforms, cx: number, cy: number, R: number): void {
    U.core.set([cx, cy, R * this.S.x, 1]);
    for (let i = 0; i < 4; i++) {
      U.modeA[i] = this.m[i]!.a.x;
      U.modeP[i] = this.m[i]!.ph;
    }
    U.shear[0] = this.shx.x;
    U.ripple.set([this.rip, 16, this.ripPh, 0]);
  }
}

interface Wave {
  cx: number;
  cy: number;
  r0: number;
  r1: number;
  dur: number;
  int: number;
  col: number;
  w0: number;
  w1: number;
  dist: number;
  t: number;
  ph: number;
}

/** Shock waves, the crash's flash, colour split and shake. */
export class Effects {
  waves: Wave[] = [];
  flash = 0;
  ca = 0;
  readonly sx = new Sp();
  readonly sy = new Sp();

  constructor(
    private H: () => number,
    private random: () => number = Math.random,
  ) {}

  /** A ring of light from `r0` to `r1` over `dur` s (`col` 0–1 between the two colours). */
  wave(
    cx: number,
    cy: number,
    r0: number,
    r1: number,
    dur: number,
    int: number,
    col: number,
    w0: number,
    w1: number,
    dist: number,
    delay = 0,
  ): void {
    const ph = rnd(0, TAU, this.random);
    this.waves.push({ cx, cy, r0, r1, dur, int, col, w0, w1, dist, t: -delay, ph });
    if (this.waves.length > 6) this.waves.shift();
  }

  crash(g: number): void {
    this.flash = Math.max(this.flash, Math.min(1.4, g));
    this.ca = Math.max(this.ca, 0.014 * g);
    const a = rnd(0, TAU, this.random);
    this.sx.v += Math.cos(a) * this.H() * 0.42 * g;
    this.sy.v += Math.sin(a) * this.H() * 0.42 * g;
  }

  step(h: number): void {
    for (const w of this.waves) w.t += h;
    this.waves = this.waves.filter((w) => w.t < w.dur);
    this.flash *= Math.exp(-h / 0.075);
    this.ca *= Math.exp(-h / 0.13);
    this.sx.to(0, 1200, 0.2, h);
    this.sy.to(0, 1200, 0.2, h);
  }

  reset(): void {
    this.waves = [];
    this.flash = 0;
    this.ca = 0;
    this.sx.set(0);
    this.sy.set(0);
  }

  fill(U: Uniforms, crashSetting: number): void {
    let n = 0;
    for (const w of this.waves) {
      if (w.t < 0) continue;
      const u = w.t / w.dur;
      const e = 1 - Math.pow(1 - u, 3);
      U.waveA.set([w.cx, w.cy, lerp(w.r0, w.r1, e), lerp(w.w0, w.w1, u)], n * 4);
      U.waveB.set([w.int * (1 - u) * (1 - u), w.col, w.dist * (1 - u), w.ph], n * 4);
      n++;
    }
    U.nw = n;
    U.flash = this.flash * crashSetting;
    U.ca = this.ca;
    U.shake[0] = this.sx.x;
    U.shake[1] = this.sy.x;
  }

  /** How far the waves reach now (px from their middle), for the window's region. */
  reach(): number {
    let r = 0;
    for (const w of this.waves) {
      const u = Math.max(0, w.t / w.dur);
      r = Math.max(r, lerp(w.r0, w.r1, 1 - Math.pow(1 - u, 3)) * 1.08 + w.w0 * 2);
    }
    return r;
  }
}
