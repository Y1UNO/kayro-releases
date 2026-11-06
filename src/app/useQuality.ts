import { useAutoQuality } from "../design/autoQualityStore";
import { effectiveQuality, rungQuality, type Quality } from "../design/quality";
import { useHub } from "../store";

/** The level drawn now: the saved one, or where « Auto » stands (re-renders when it moves). */
export function useEffectiveQuality(): Quality {
  const saved = useHub((s) => s.settings?.quality);
  const rung = useAutoQuality((s) => s.rung);
  return saved === "auto" ? rungQuality(rung) : effectiveQuality(saved);
}

/** True while the level drawn is Eco (the saved one, or « Auto » down there). */
export function useEco(): boolean {
  return useEffectiveQuality() === "eco";
}
