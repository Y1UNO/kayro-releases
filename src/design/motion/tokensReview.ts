/**
 * Motion tokens of the review of 2026-10-29 (Opus 5.5 pass, `docs/DA-JOURNAL.md` § « Gel de la
 * DA »). Times in ms. Data only.
 */

/** 3D hover of the cards (carousel and grid): eased tilt, the engine's glass follows it. */
export const CARD_TILT = {
  /** Time constant of the tilt towards the pointer (ms, ≈ 63 % reached). */
  followMs: 90,
  /** …and back to flat when the pointer leaves: slower, the card settles. */
  leaveMs: 190,
  /** The DOM's perspective on a card (AppCard.module.css `.slot`, px). */
  perspective: 900,
} as const;

/** 3D hover of the category fan: the most the pointer tilt and the sway add up to (deg). */
export const FAN_TILT_MAX = 8;

/**
 * Fewer colours on screen: a card without a picture is mostly the theme, with a hint of its icon
 * (was the icon's colours at the game colours' share, 60 %: a rainbow with many such apps).
 */
export const ICON_FACE = { intensity: "soft", character: "theme" } as const;
