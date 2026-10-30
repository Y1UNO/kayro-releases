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
 * A card without a picture takes its logo's colours (step 19c, the user: « sinon ça déteint »): full
 * share, vivid bounds. Was « soft / theme » from 29/10 (fewer colours on screen).
 */
export const ICON_FACE = { intensity: "strong", character: "vivid" } as const;
