import { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Theme } from "../../design";
import type { FxTarget } from "../../fx";
import type { AppPalette, ColorPassage } from "../../ipc/bindings";
import { useArt, useHub } from "../../store";
import { DEFAULT_CHOICE, deriveGameColors, type GameColors, type GameSource } from "./derive";
import { gameColorsStore } from "./store";

export interface GameColorsView {
  /** The game's colours, or null when the theme's apply. */
  colors: GameColors | null;
  /** The last change plays the passage, from `origin`, started at `since`. */
  tide: boolean;
  origin: FxTarget | null;
  since: number;
  /** How the colours go from one app to the next (setting « Passage d'un jeu à l'autre »). */
  passage: ColorPassage;
}

/**
 * Poster first (with the hero as its other image), else the hero, else the icon (V10 b, unless the
 * setting « Apps sans image » says the theme's).
 */
export function sourceOf(
  list: readonly AppPalette[] | undefined,
  fromIcon = true,
): GameSource | null {
  const of = (s: AppPalette["source"]) => list?.find((p) => p.source === s)?.palette ?? null;
  const poster = of("poster");
  const hero = of("hero");
  if (poster) return { main: poster, other: hero };
  if (hero) return { main: hero, other: null };
  const icon = fromIcon ? of("icon") : null;
  return icon ? { main: icon, other: null } : null;
}

/**
 * The settings of « Couleurs du jeu », as plain values: a component re-renders only when one of
 * them changes, never for another setting (step 14, measured 14/10: whole-object subscriptions
 * re-rendered every card).
 */
export function useColorSettings() {
  return useHub(
    useShallow((s) => ({
      mode: s.settings?.colorMode ?? "light",
      intensity: s.settings?.colorIntensity ?? DEFAULT_CHOICE.intensity,
      character: s.settings?.colorCharacter ?? DEFAULT_CHOICE.character,
      pick: s.settings?.colorPick ?? DEFAULT_CHOICE.pick,
      fromIcon: s.settings?.colorFromIcon ?? true,
      passage: s.settings?.colorPassage ?? "tide",
    })),
  );
}

/** The colours of the shown app for `theme`, live (store, palettes, settings, the app's choice). */
export function useGameColors(theme: Theme): GameColorsView {
  const { shown, origin, since, tide } = useStore(
    gameColorsStore,
    useShallow((s) => s),
  );
  const cs = useColorSettings();
  const own = useHub((s) => (shown ? s.apps.find((a) => a.id === shown)?.colors : null) ?? null);
  const palettes = useArt((s) => (shown ? s.palettes[shown] : undefined));
  return useMemo(() => {
    const choice = { intensity: cs.intensity, character: cs.character, pick: cs.pick };
    const colors = deriveGameColors(theme, sourceOf(palettes, cs.fromIcon), cs.mode, choice, own);
    return { colors, tide, origin, since, passage: cs.passage };
  }, [theme, cs, own, palettes, tide, origin, since]);
}
