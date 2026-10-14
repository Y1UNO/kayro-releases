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
  /**
   * Variant C's veil (round 4b, review C): black at this opacity over everything the engine draws,
   * outside the open circle (centre x, y, radius, opacity; absent or 0 = none).
   */
  veil?: [number, number, number, number];
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
    a.draw[2] === b.draw[2] &&
    sameVeil(a.veil, b.veil)
  );
}

function sameVeil(a: IntroFrame["veil"], b: IntroFrame["veil"]): boolean {
  if (!a || !b) return (a?.[3] ?? 0) === (b?.[3] ?? 0);
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/**
 * A glass shape whose pose a sequence knows (round 3b: cards of the category fan, apps of the
 * deck). The engine draws it from this pose instead of measuring the element: a rotated element's
 * `getBoundingClientRect` is its bounding box, not its shape. Viewport CSS px, angle in radians
 * (clockwise, like CSS `rotate`).
 */
export interface GlassPose {
  x: number;
  y: number;
  hw: number;
  hh: number;
  /** Corner radius (px, already scaled). */
  r: number;
  a: number;
  /** Edge softness (px): a card leaving the fan blurs out without any CSS filter. */
  soft: number;
  /** Stack order (≥ 1, back to front): stacked cards overlap without merging. 0 = merged as usual. */
  z: number;
  /** Floating height (round 5), 0–1: its ground shadow tightens and pales as the card rises. */
  elev?: number;
}

/**
 * The hovered card of the fan (round 3b): the engine deepens its shadow. Its light threads and
 * sparks are DOM, above the cards: the engine draws under the DOM, so where cards overlap the
 * neighbour's picture would hide anything drawn on the hovered card's rim.
 */
export interface HoverCue {
  el: Element;
  /** Hover level 0–1. */
  h: number;
}

/** One moment of the home screen's category sequences, as the engine draws it. */
export interface StageFrame {
  poses: ReadonlyMap<Element, GlassPose>;
  /** Home liquid ring: vertical offset (px), scale, opacity. */
  ring: readonly [number, number, number];
  hover?: HoverCue | null;
}

export type StageSampler = (now: number) => StageFrame | null;

let stage: StageSampler | null = null;

/** The category fan / deck registers its sampler while it is on screen (null when it leaves). */
export function setStageCue(s: StageSampler | null): void {
  stage = s;
  version++;
}

export function stageCue(): StageSampler | null {
  return stage;
}

/** Same ring and hover cue (the poses are compared by the glass frame itself). */
export function sameRing(a: StageFrame | null, b: StageFrame | null): boolean {
  const x = a?.ring;
  const y = b?.ring;
  if (!x || !y) return x === y;
  const ha = a?.hover ?? null;
  const hb = b?.hover ?? null;
  const sameHover = ha === hb || (ha !== null && hb !== null && ha.el === hb.el && ha.h === hb.h);
  return x[0] === y[0] && x[1] === y[1] && x[2] === y[2] && sameHover;
}
