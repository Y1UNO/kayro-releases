import type { Settings } from "../../../ipc/bindings";
import { rgbOf } from "../music";
import type { StageLook } from "./stageTypes";

/**
 * Kysland's music mode: its settings (Réglages › Visuel › Mode musique) as the engine wants them.
 * Kayro's « Éco » quality draws the player at low resolution unless one was chosen. The theme's
 * colours: its accent and the island's tone.
 */
export function lookOf(s: Settings | null | undefined, eco: boolean, tone: string): StageLook {
  const accent =
    rgbOf(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()) ?? tone;
  const quality = s?.musicQuality ?? "auto";
  return {
    bass: s?.musicBass ?? 1,
    crash: s?.musicCrash ?? 1,
    trails: s?.musicTrails ?? 0.6,
    gloss: s?.musicGloss ?? 0,
    quality: eco && quality === "auto" ? "low" : quality,
    demo: s?.musicDemo ?? false,
    colors: s?.musicColors ?? "cover",
    delayMs: s?.musicDelayMs ?? 0,
    theme: [accent, tone],
  };
}
