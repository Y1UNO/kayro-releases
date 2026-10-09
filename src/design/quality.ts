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
