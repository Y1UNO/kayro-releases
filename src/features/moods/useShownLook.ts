import { useMemo } from "react";
import { useStore } from "zustand";
import type { FxPalette } from "../../fx";
import type { FxMood } from "../../fx/mood/types";
import { useHub } from "../../store";
import { useArtUrl } from "../home/art";
import { gameColorsStore } from "../gameColors/store";
import { fxMoodOf, useUserMoods } from "./moodsStore";

export interface ShownLook {
  mood: FxMood | null;
  special: FxPalette["special"];
  /** The special card's background (the app's « Fond »), shown even outside Immersif. */
  hero: FxPalette["hero"];
}

/**
 * Steps 16–17: what the shown app adds to the atmosphere: its ambience, and its special card when
 * the user gave it a cut-out character (left or right). Nothing with « Couleurs du jeu » off.
 */
export function useShownLook(): ShownLook {
  const shown = useStore(gameColorsStore, (s) => s.shown);
  const app = useHub((s) => (shown ? s.apps.find((a) => a.id === shown) : undefined));
  const off = useHub((s) => s.settings?.colorMode === "off");
  const users = useUserMoods();
  const id = off ? "" : (shown ?? "");
  const left = useArtUrl(id, "charLeft");
  const right = useArtUrl(id, "charRight");
  const logo = useArtUrl(id, "logo");
  const hero = useArtUrl(id, "hero");
  const mood = useMemo(
    () => (off ? null : fxMoodOf(app)),
    // `users`: an imported ambience may arrive after the app that uses it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [off, app?.moodId, app?.moodTune?.density, app?.moodTune?.speed, users],
  );
  return useMemo(() => {
    const special = id && (left || right) ? { left, right, logo } : null;
    return { mood, special, hero: special && hero ? { url: hero, blurred: false } : null };
  }, [id, mood, left, right, logo, hero]);
}
