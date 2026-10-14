/** Visual quality levels (step 13 adds the automatic fallback and persistence). */
export const QUALITIES = ["eco", "balanced", "high", "ultra"] as const;
export type Quality = (typeof QUALITIES)[number];

export const QUALITY_LABELS: Record<Quality, string> = {
  eco: "Éco",
  balanced: "Équilibré",
  high: "Élevé",
  ultra: "Ultra",
};

/** Components read the level from `data-quality` on the root element (pure CSS, no re-render). */
export function applyQuality(quality: Quality): void {
  document.documentElement.dataset.quality = quality;
}

/** The level drawn for a saved quality: « Auto » (round 5) = high, with the engine's fallback. */
export function effectiveQuality(q: Quality | "auto" | null | undefined): Quality {
  return q === "auto" ? "high" : (q ?? "balanced");
}

/**
 * Whether the level drawn is Eco: what the scripts test (review A11). Through `effectiveQuality`,
 * the one place to change when « Auto » learns to go down to Eco (step 13).
 */
export function isEco(q: Quality | "auto" | null | undefined): boolean {
  return effectiveQuality(q) === "eco";
}
