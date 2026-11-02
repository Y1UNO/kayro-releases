/**
 * Step 20 (Kysland): the island's shape, as pure functions of a few animated values, so its
 * feel is tested and not tuned by eye only. Docked, it is a black notch whose top is the
 * screen's edge (square top corners, two « shoulders » curving into the bezel); slid into a top
 * corner, it is flush with the top and side bezels (shoulders along both); floating, a capsule
 * with a rim. The core moves the window; here the island stretches, leans and squashes inside it.
 * Sizes in logical pixels; the window's sizes are the core's (`desktop/island/mod.rs`: `WINDOW`,
 * `ANCHOR`), repeated here.
 */

export const STAGE = { width: 720, height: 420 } as const;
export const ANCHOR = { x: 360, y: 150 } as const;
export const DOCKED = { width: 184, height: 32 } as const;
export const FLOATING = { width: 176, height: 44 } as const;
/** Opened (its panel): its size follows its content (`panelSize.ts`); this one at first. */
export const OPEN = { width: 360, height: 140, radius: 26 } as const;
/** What hovering adds, docked and floating (inside the core's click region). */
export const HOVER_GROW = { docked: [20, 4], floating: [14, 4] } as const;

export interface Spring {
  k: number;
  zeta: number;
}

/** One animated value: where it is, how fast, and where it goes. */
export interface Animated {
  x: number;
  v: number;
  to: number;
}

export const anim = (x: number): Animated => ({ x, v: 0, to: x });

/** Steps `a` by `dt` seconds (semi-implicit Euler in ≤ 4 ms slices: stable at any rate). */
export function stepSpring(a: Animated, s: Spring, dt: number): void {
  const c = 2 * s.zeta * Math.sqrt(s.k);
  let left = Math.min(Math.max(dt, 0), 0.05);
  while (left > 1e-9) {
    const h = Math.min(left, 0.004);
    a.v += ((a.to - a.x) * s.k - a.v * c) * h;
    a.x += a.v * h;
    left -= h;
  }
}

export function atRest(a: Animated, eps = 0.002): boolean {
  return Math.abs(a.to - a.x) < eps && Math.abs(a.v) < eps * 20;
}

export function settle(a: Animated): void {
  a.x = a.to;
  a.v = 0;
}

/** The springs of each value. Pull and squish wobble (jelly), the morphs are soft. */
export const SPRINGS = {
  morph: { k: 260, zeta: 0.74 },
  corner: { k: 420, zeta: 0.82 },
  hover: { k: 420, zeta: 0.8 },
  pull: { k: 900, zeta: 0.42 },
  lean: { k: 520, zeta: 0.9 },
  squish: { k: 700, zeta: 0.32 },
  presence: { k: 380, zeta: 0.72 },
  open: { k: 300, zeta: 0.76 },
  /** Music shown at rest, a launch's stretch, the dots on hover: lively, one small overshoot. */
  rest: { k: 360, zeta: 0.7 },
  backdrop: { k: 40, zeta: 1 },
} as const satisfies Record<string, Spring>;

/** « Reduce motion »: every value settles without overshoot. */
export const CALM: Spring = { k: 700, zeta: 1 };

/** The jelly never goes past this (taps in a row add up, the island never folds over). */
export const SQUISH_LIMIT = 1.4;

export interface Values {
  /** 0 = on the top edge, 1 = floating capsule. */
  morph: number;
  /** -1 = flush in the left corner, 0 = the notch, 1 = flush in the right corner. */
  corner: number;
  hover: number;
  /** Docked: x = push past a corner, y = the downward pull. Floating: the push on an edge. */
  pullX: number;
  pullY: number;
  /** Velocity (logical px/s), smoothed. */
  vx: number;
  vy: number;
  /** A tap's or a landing's jelly. */
  squish: number;
  /** 0 → 1 as the island comes out of the bezel when shown. */
  presence: number;
  /** « Cacher l'île » with « reduce motion »: a plain fade (1 when not given). */
  fade?: number;
  /** 0 = the island, 1 = opened into its panel. */
  open: number;
  /** The opened island's size, which follows its content (`OPEN` when not given). */
  openW?: number;
  openH?: number;
  /** At rest: music shown (cover and bars), a launch stretching it, the running apps' dots. */
  media: number;
  stretch: number;
  dots: number;
}

export interface Shape {
  width: number;
  height: number;
  /** Corner radii: top-left, top-right, bottom-right, bottom-left. */
  radii: [number, number, number, number];
  /** Shoulders (0–1): along the top on the left and right, along the sides below. */
  shoulders: { topLeft: number; topRight: number; sideLeft: number; sideRight: number };
  /** The rim's and the shadow's strength (0–1): floating only. */
  rim: number;
  x: number;
  y: number;
  rotate: number;
  skew: number;
  scaleX: number;
  scaleY: number;
  /** Transform origin, as a fraction of the height (0 = top edge, docked). */
  originY: number;
  opacity: number;
  /** The panel's content (0–1): it shows once the island has grown. */
  content: number;
  /** What shows inside the island at rest (0–1): the music, a launch, the dots (on hover). */
  rest: { music: number; stretch: number; dots: number };
  /** The height of the island without its dots (its row of content). */
  band: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function shapeOf(v: Values): Shape {
  const m = clamp(v.morph, 0, 1.2);
  const mm = clamp(m, 0, 1);
  const docked = 1 - mm;
  const growW = lerp(HOVER_GROW.docked[0], HOVER_GROW.floating[0], mm);
  const growH = lerp(HOVER_GROW.docked[1], HOVER_GROW.floating[1], mm);
  const o = clamp(v.open, 0, 1.2);
  const oc = clamp(o, 0, 1);
  const hover = v.hover * (1 - oc);
  const closed = 1 - oc;
  const launch = clamp(v.stretch, 0, 1.2);
  const grown = (v.media * 44 + launch * 130) * closed;
  // The running apps' dots: only on the top edge (floating, the island stays a plain capsule).
  const dotsShown = clamp(v.dots, 0, 1) * (1 - clamp(v.morph, 0, 1));
  const dots = dotsShown * hover * 26 * closed;
  const band = lerp(DOCKED.height, FLOATING.height, m) + growH * hover;
  const [openW, openH] = [v.openW ?? OPEN.width, v.openH ?? OPEN.height];
  let width = lerp(lerp(DOCKED.width, FLOATING.width, m) + growW * hover + grown, openW, o);
  let height = lerp(band + dots, openH, o);
  let x = 0;
  let y = 0;
  // Docked and pulled down: it stretches like a drop, and narrows.
  const down = Math.max(0, v.pullY) * docked;
  height += down * 0.55;
  width -= down * 0.2;
  // Floating and pushed on the top or bottom edge: it flattens against it.
  const lid = Math.abs(v.pullY) * mm;
  width += lid * 0.45;
  height -= lid * 0.6;
  if (v.pullY > 0) y += lid * 0.6 * mm;
  // In a corner, the flush side stays on its bezel when the island grows or shrinks.
  const fl = clamp(-v.corner, 0, 1) * docked;
  const fr = clamp(v.corner, 0, 1) * docked;
  x += (fl - fr) * ((width - DOCKED.width) / 2);
  // Pushed on a side (an edge of the screen, or past a corner): it flattens against it, its
  // side on the edge, never past it.
  const side = Math.abs(v.pullX);
  const flat = side * 0.9;
  width -= flat;
  height += side * 0.35;
  x += Math.sign(v.pullX) * (flat / 2);
  // Moving: floating, it leans into the motion; docked, it trails behind like jelly.
  const rotate = clamp(v.vx * 0.005, -7, 7) * mm;
  const skew = clamp(-v.vx * 0.004, -12, 12) * docked;
  const speed = Math.hypot(v.vx, v.vy);
  const stretch = Math.min(speed / 6000, 0.07);
  const along = speed > 1 ? Math.abs(v.vx) / speed : 0;
  const squish = clamp(v.squish, -SQUISH_LIMIT, SQUISH_LIMIT);
  const scaleX = 1 + stretch * along - stretch * (1 - along) * 0.5 + squish * 0.08;
  const scaleY = 1 + stretch * (1 - along) - stretch * along * 0.5 - squish * 0.1;
  const p = clamp(v.presence, 0, 1.2);
  const shown = clamp(p, 0, 1);
  const before = width;
  width = Math.max(width * lerp(0.3, 1, p), 8);
  height = Math.max(height * lerp(0.15, 1, p), 4);
  x += (fl - fr) * ((width - before) / 2);
  const capsule = Math.min(width, height) / 2;
  const top = lerp(capsule * mm, OPEN.radius * mm, oc);
  const bottom = lerp(capsule, OPEN.radius, oc);
  return {
    width,
    height,
    radii: [top, top, bottom * (1 - fr), bottom * (1 - fl)],
    shoulders: {
      topLeft: docked * (1 - fl) * shown,
      topRight: docked * (1 - fr) * shown,
      sideLeft: fl * shown,
      sideRight: fr * shown,
    },
    rim: mm,
    x,
    y,
    rotate,
    skew,
    scaleX,
    scaleY,
    originY: 0.5 * mm,
    opacity: clamp(p * 2.5, 0, 1) * clamp(v.fade ?? 1, 0, 1),
    content: clamp((o - 0.6) / 0.35, 0, 1),
    rest: {
      music: clamp(v.media, 0, 1) * clamp(1 - launch, 0, 1) * closed * clamp(p, 0, 1),
      stretch: clamp(launch, 0, 1) * closed,
      dots: dotsShown * clamp(v.hover, 0, 1) * closed,
    },
    band,
  };
}

type Rgb = readonly [number, number, number];

/** « Bleu neige » on dark screens, a deep ink blue on light ones. */
export const SNOW: Rgb = [214, 236, 255];
export const INK: Rgb = [28, 52, 84];

export interface Palette {
  /** The rim, the hover line and the bubbles: light on a dark screen, dark on a light one. */
  tone: Rgb;
  rimAlpha: number;
  /** The rim's soft glow (only where it can be seen: on a dark screen). */
  glowAlpha: number;
  /** A bubble's small highlight. */
  shine: Rgb;
}

/** The island's colours for the lightness (0–1) of the screen around it. */
export function paletteFor(lightness: number): Palette {
  const t = clamp((lightness - 0.42) / 0.22, 0, 1);
  const s = t * t * (3 - 2 * t);
  const mix = (a: Rgb, b: Rgb): Rgb => [
    Math.round(lerp(a[0], b[0], s)),
    Math.round(lerp(a[1], b[1], s)),
    Math.round(lerp(a[2], b[2], s)),
  ];
  return {
    tone: mix(SNOW, INK),
    rimAlpha: lerp(0.55, 0.42, s),
    glowAlpha: lerp(0.28, 0, s),
    shine: mix([255, 255, 255], [150, 190, 230]),
  };
}
