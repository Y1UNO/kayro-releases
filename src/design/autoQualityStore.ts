import { createStore, useStore } from "zustand";
import type { AutoState } from "../fx/autoQuality";

/**
 * Where « Auto » stands right now (step 24): its rung, why it went down, frozen or not. Written by
 * the main window's watcher (src/app/autoQualityWatch.ts); read by `effectiveQuality` and the
 * settings. Other windows (the island) never move it: there, « Auto » stays high.
 */
export const autoQualityStore = createStore<{ state: AutoState }>(() => ({
  state: { rung: "high", reason: null, frozen: false },
}));

export function useAutoQuality<T>(pick: (s: AutoState) => T): T {
  return useStore(autoQualityStore, (s) => pick(s.state));
}
