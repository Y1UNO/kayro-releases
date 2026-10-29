/**
 * Round 5's part of the motion token table (reference/animations/R5-notes/…): the cards' floating
 * levels, the « Personnalisation avancée » drop-down, the theme change wave. Times in ms at speed 1
 * (divided by the motion speed where they are used). Data only: nothing here imports tokens.ts.
 */

/** « Mouvement » (Réglages › Visuel): `lively` = the validated « Vivant intelligent ». */
export const MOTION_STYLES = ["complete", "lively", "crisp"] as const;
export type MotionStyle = (typeof MOTION_STYLES)[number];

/** « Survol des cartes » (app cards): threads + veil, lift only, nothing. */
export const CARD_HOVER_STYLES = ["full", "simple", "none"] as const;
export type CardHoverStyle = (typeof CARD_HOVER_STYLES)[number];

/** « Flottaison des cartes » (R5-Flottaison.txt). */
export const FLOAT_NAMES = ["none", "light", "visible", "strong"] as const;
export type FloatName = (typeof FLOAT_NAMES)[number];

export interface FloatLevel {
  /** Amplitude of the category fan's cards (px, ±). */
  fan: number;
  /** Amplitude of the carousel's app cards (« sous-catégories », px, ±). */
  carousel: number;
  /** Rocking (deg, ±), one card in two the other way. */
  tilt: number;
  /** Period of one rise and fall (ms), before each card's own factor. */
  period: number;
}

/**
 * Levels of the note. « Légère » keeps the real values the fan had before R5 (2.5 px, 7 s,
 * ≈ 0.1° of rocking) as the note asks when they differ from its sketch (± 0.3°, 5.2 s).
 */
export const FLOAT_LEVELS: Readonly<Record<FloatName, FloatLevel>> = {
  none: { fan: 0, carousel: 0, tilt: 0, period: 7000 },
  // Review 2026-10-29: « Visible » was still read as « à peine visible » (7 / 5 px, 0.8°).
  light: { fan: 4, carousel: 3, tilt: 0.4, period: 6000 },
  visible: { fan: 10, carousel: 7, tilt: 1.1, period: 4600 },
  strong: { fan: 15, carousel: 11, tilt: 1.8, period: 5000 },
};

export const FLOAT_RHYTHM = {
  /** Each card's period: × 0.90 to × 1.07 of the level's. */
  periodMin: 0.9,
  periodMax: 1.07,
  /**
   * Review 2026-10-29: the card also drifts sideways, this share of its amplitude, on a slower
   * sine (× `driftPeriod`): its path is a soft loop, not a piston.
   */
  driftShare: 0.3,
  driftPeriod: 1.63,
  /** Each card starts 0.6 to 0.7 s after the previous one: never « en bloc ». */
  staggerMin: 600,
  staggerMax: 700,
  /** Ground shadow at the top of the rise: opacity 0.55 → 0.32 (ratio), tightened × 0.9. */
  shadowAlpha: 0.32 / 0.55,
  shadowScale: 0.9,
  /** Peak-to-peak height (px) at which the shadow change is complete (« Marquée » on the fan). */
  shadowFullAt: 30,
  /** A carousel card pauses its floating (hover, fast scroll) over this (ms)… */
  pauseMs: 240,
  /** …and comes back to it slowly (after a category sequence, a hover): no jolt (ms, ≈ 95 %). */
  resumeMs: 1200,
  /** The carousel's active card (the one read, plate and pencil) floats less (review B3; was 1). */
  activeGain: 0.7,
  /**
   * The fan's hovered card sways sideways this much (px, ±), none at « Aucune » (review B3; was
   * 0.66 × `floatHover` 6 = 3.96, at every level).
   */
  fanHoverDrift: 4,
} as const;

/**
 * « Personnalisation avancée » opens like the widget's glass (R5-Personnalisation.txt): the shell
 * on the widget's « normale » springs (vertical 5 % over 680 ms, sides 2.5 % over 560 ms), the
 * chevron on the vertical one, rows one by one.
 */
export const ADVANCED_UNROLL = {
  fromScaleY: 0.04,
  fromScaleX: 0.94,
  vMs: 680,
  hMs: 560,
  hullFade: 60,
  /** Review B4: a cascade that ends with the shell (was 50 / 45: the last row 300 ms late). */
  rowAt: 40,
  rowStep: 32,
  rowRise: 10,
  rowFade: 260,
  rowMs: 520,
  /** Closing: the « disparition » curve, no bounce, no cascade. */
  foldMs: 220,
  /** The halo while open (review B4: was 0.22, unseen at rest). */
  haloAlpha: 0.3,
  /** Opened, the panel scrolls to show what follows, with this room under it (px)… */
  revealPad: 24,
  /** …but the header row stays this far under the panel's top at least (px). */
  revealTop: 8,
} as const;

/**
 * The theme change (R5-Reglages-Themes.txt §2): the card rises, is squashed (the impact at 380 ms),
 * then the wave leaves its moon and the new theme is revealed behind it. Curves: names of EASES
 * or `cubic-bezier(…)`.
 */
export const THEME_SWAP = {
  hover: { scale: 1.03, ms: 240, ease: "liaison" },
  press: { scale: 1.05, ms: 140, ease: "vive" },
  rise: { at: 0, ms: 260, y: -8, scale: 1.1, ease: "premium" },
  squash: { at: 260, ms: 120, y: 2, scale: 0.93, ease: "cubic-bezier(0.55, 0, 0.75, 0.2)" },
  impact: 380,
  settle: { at: 380, ms: 340, ease: "liaison" },
  sheen: { at: 60, ms: 620, ease: "cubic-bezier(0.45, 0, 0.25, 1)" },
  moon: { at: 370, ms: 560, glow: 2.4, scale: 1.06 },
  /** Review B2 (onde de choc, pas une lueur): halo 40 → 28, alpha 0.85 → 0.7. */
  shock: { at: 380, ms: 620, spread: 18, halo: 28, alpha: 0.7, ease: "vive" },
  sparks: { at: 380, ms: 620, count: 12, from: 46, to: 82, stagger: 66, ease: "vive" },
  recoil: { at: 380, ms: 420, scale: 0.993, ease: "rebond" },
  frame: { at: 400, ms: 520, width: 2.4, ease: "bascule" },
  /**
   * The wave of the C pulse: a 400 px circle scaled to the farthest corner, full until 80 %. Its
   * glow keeps `haloPx` on screen whatever the scale (review B1; before: 5.5 % of the radius).
   */
  wave: { at: 400, ms: 850, ease: "standard", size: 400, full: 0.8, haloPx: 40 },
  check: { at: 620, ms: 380, peak: 1.35, ease: "rebond" },
  end: 1250,
  /**
   * Eco and « Fondu » (step 13): from the impact, the new page fades in over the frozen old one
   * (a View Transition: one capture, then opacity on the compositor). Before: the theme variables
   * cross-faded on <html> for 0.9 s, the whole page restyled and repainted at every frame.
   */
  fade: { ms: 900, ease: "standard" },
  /** How Eco changes theme: « fade » (above), or « direct » if the fade ever misses the budget. */
  ecoWay: "fade" as "fade" | "direct",
} as const;
