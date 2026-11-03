import type { Body, Effects } from "./jelly";
import { clamp, rnd, TAU } from "./motion";
import type { Music } from "./music";

/**
 * Kysland's music mode: a big saturated bass (2026-11-03). The bubble rumbles, round (its modes 2
 * and 3 shaken around 9 Hz, off their resonance) and breathes deeper, its halo and the sub's
 * string thicken; in full when the bass crushes the mix more than usual (`heavy`), a third of it
 * under a sub merely strong and held. And it sizzles (« ça grésille pas assez »): about 30 times
 * a second, a flicker of colour split, a 1–3 px jolt, a faint fine shiver of its edge, the sub's
 * string crackling. Logical px, s.
 */
export class Rumble {
  /** How much it rumbles (0–2, with the bass setting); the sub string's crackle (0–1). */
  level = 0;
  crackle = 0;
  private subSlow = 0;
  private t = 0;
  private fizzT = 0;

  step(
    h: number,
    M: Music,
    bass: number,
    body: Body,
    fx: Effects,
    H: number,
    random: () => number,
  ): void {
    this.subSlow += (M.subIn - this.subSlow) * (1 - Math.exp(-h / 0.25));
    const x = clamp((this.subSlow - 0.55) / 0.35, 0, 1);
    this.level = Math.max(clamp(M.heavy, 0, 1), 0.35 * x * x * (3 - 2 * x)) * bass;
    this.t += h;
    const w = this.t * TAU * 9;
    body.m[0]!.a.v += 36 * this.level * Math.cos(w) * h;
    body.m[1]!.a.v += 24 * this.level * Math.cos(w * 1.3 + 1) * h;
    this.fizzT += h;
    if (this.level > 0.05 && this.fizzT > 1 / 30) {
      this.fizzT = 0;
      const r = this.level;
      fx.ca = Math.max(fx.ca, 0.006 * r * rnd(0.4, 1, random));
      fx.sx.v += rnd(-1, 1, random) * H * 0.05 * r;
      fx.sy.v += rnd(-1, 1, random) * H * 0.05 * r;
      body.rip = Math.max(body.rip, 0.006 * r);
      body.ripPh += rnd(0, TAU, random);
      this.crackle = rnd(0, 0.6, random) * r;
    }
    this.crackle *= Math.exp(-h / 0.03);
  }
}
