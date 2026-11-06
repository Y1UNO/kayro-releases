import { autoQualityStore } from "./autoQualityStore";
import type { AutoRung } from "../fx/autoQuality";

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

/** The level drawn at each rung of « Auto » (its first rungs only lighten two effects). */
export function rungQuality(rung: AutoRung): Quality {
  return rung === "eco" ? "eco" : rung === "balanced" ? "balanced" : "high";
}

/**
 * The level drawn for a saved quality. « Auto » (step 24): where the watcher stands now (high
 * until frames are missed, see src/fx/autoQuality.ts), with the engine's own fallback too.
 */
export function effectiveQuality(q: Quality | "auto" | null | undefined): Quality {
  return q === "auto" ? rungQuality(autoQualityStore.getState().state.rung) : (q ?? "balanced");
}

/**
 * Whether the level drawn is Eco: what the scripts test (review A11). Through `effectiveQuality`
 * (« Auto » may be there now). Components use `useEco()` (src/app/useQuality.ts) to follow it.
 */
export function isEco(q: Quality | "auto" | null | undefined): boolean {
  return effectiveQuality(q) === "eco";
}
