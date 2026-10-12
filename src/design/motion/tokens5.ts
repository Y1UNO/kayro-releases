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
  light: { fan: 2.5, carousel: 2, tilt: 0.1, period: 7000 },
  visible: { fan: 7, carousel: 5, tilt: 0.8, period: 4400 },
  strong: { fan: 12, carousel: 8, tilt: 1.4, period: 4800 },
};

export const FLOAT_RHYTHM = {
  /** Each card's period: × 0.90 to × 1.07 of the level's. */
  periodMin: 0.9,
  periodMax: 1.07,
  /** Each card starts 0.6 to 0.7 s after the previous one: never « en bloc ». */
  staggerMin: 600,
  staggerMax: 700,
  /** Ground shadow at the top of the rise: opacity 0.55 → 0.32 (ratio), tightened × 0.9. */
  shadowAlpha: 0.32 / 0.55,
  shadowScale: 0.9,
  /** Peak-to-peak height (px) at which the shadow change is complete (« Marquée » on the fan). */
  shadowFullAt: 24,
  /** A carousel card pauses / resumes its floating (hover, fast scroll) over this (ms). */
  pauseMs: 240,
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
  rowAt: 50,
  rowStep: 45,
  rowRise: 10,
  rowFade: 260,
  rowMs: 520,
  /** Closing: the « disparition » curve, no bounce, no cascade. */
  foldMs: 220,
  haloAlpha: 0.22,
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
  shock: { at: 380, ms: 620, spread: 18, halo: 40, alpha: 0.85, ease: "vive" },
  sparks: { at: 380, ms: 620, count: 12, from: 46, to: 82, stagger: 66, ease: "vive" },
  recoil: { at: 380, ms: 420, scale: 0.993, ease: "rebond" },
  frame: { at: 400, ms: 520, width: 2.4, ease: "bascule" },
  /** The wave of the C pulse: a 400 px circle scaled to the farthest corner, full until 80 %. */
  wave: { at: 400, ms: 850, ease: "standard", size: 400, full: 0.8 },
  check: { at: 620, ms: 380, peak: 1.35, ease: "rebond" },
  end: 1250,
  /** Eco and « Fondu »: the cross-fade of the theme variables, from the impact. */
  fadeMs: 900,
} as const;
