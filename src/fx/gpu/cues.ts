/**
 * Cues: what a scripted sequence of the interface asks the glass engine to draw (art direction
 * round 3). The engine never imports a screen: a screen registers a sampler, and the engine calls
 * it with its own frame time at every frame it draws, so the canvas and the DOM (driven by the
 * same clock, src/design/motion/choreo.ts) show the same moment.
 */

/** One moment of the opening, as the engine draws it. Lengths in CSS px, opacities 0–1. */
export interface IntroFrame {
  /** Background (gradient, stars, bokeh) fading in from the darkest theme colour. */
  fade: number;
  /** Home layers (moon halo, veils, light bands, liquid ring): 0 during the opening. */
  home: number;
  /** Embers. */
  embers: number;
  /** Halo centred on the ring: centre, radius x (y = 0.794 × x), opacity. */
  halo: [number, number, number, number];
  /** Ring: centre, radius, opacity. */
  ring: [number, number, number, number];
  /** Drawn fraction of the ring (from the top, clockwise), glint angle (rad), glint opacity, scale. */
  draw: [number, number, number, number];
}

export type IntroSampler = (now: number) => IntroFrame | null;

let intro: IntroSampler | null = null;
let version = 0;

/** The opening registers its sampler while it runs (null when it ends). */
export function setIntroCue(s: IntroSampler | null): void {
  intro = s;
  version++;
}

export function introCue(): IntroSampler | null {
  return intro;
}

/** Changes whenever a cue is set or cleared (the engine redraws once more). */
export function cueVersion(): number {
  return version;
}

/** Same opening picture (the engine skips the frame). */
export function sameIntro(a: IntroFrame | null, b: IntroFrame | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.fade === b.fade &&
    a.home === b.home &&
    a.embers === b.embers &&
    a.halo[3] === b.halo[3] &&
    a.halo[2] === b.halo[2] &&
    a.ring[0] === b.ring[0] &&
    a.ring[1] === b.ring[1] &&
    a.ring[2] === b.ring[2] &&
    a.ring[3] === b.ring[3] &&
    a.draw[0] === b.draw[0] &&
    a.draw[1] === b.draw[1] &&
    a.draw[2] === b.draw[2]
  );
}
