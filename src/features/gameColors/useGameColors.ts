import { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Theme } from "../../design";
import type { FxPalette, FxTarget } from "../../fx";
import type { AppPalette, ArtImage, ColorPassage } from "../../ipc/bindings";
import { useArt, useHub } from "../../store";
import { artUrl } from "../home/art";
import { DEFAULT_CHOICE, deriveGameColors, type GameColors, type GameSource } from "./derive";
import { gameColorsStore } from "./store";

export interface GameColorsView {
  /** The game's colours, or null when the theme's apply. */
  colors: GameColors | null;
  hero: FxPalette["hero"];
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

/** Immersive night's picture (V3 b): Steam's blurred hero, else the hero blurred by the engine. */
export function heroOf(id: string, images: readonly ArtImage[] | undefined): FxPalette["hero"] {
  const blur = images?.find((i) => i.role === "heroBlur");
  const sharp = images?.find((i) => i.role === "hero");
  if (blur) return { url: artUrl(id, blur), blurred: true };
  return sharp ? { url: artUrl(id, sharp), blurred: false } : null;
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
      hero: s.settings?.colorHero ?? true,
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
  const images = useArt((s) => (shown ? s.byId[shown] : undefined));
  return useMemo(() => {
    const choice = { intensity: cs.intensity, character: cs.character, pick: cs.pick };
    const colors = deriveGameColors(theme, sourceOf(palettes, cs.fromIcon), cs.mode, choice, own);
    const showHero = cs.mode === "immersive" && cs.hero;
    const hero = showHero && shown && colors ? heroOf(shown, images) : null;
    return { colors, hero, tide, origin, since, passage: cs.passage };
  }, [theme, cs, own, palettes, shown, images, tide, origin, since]);
}
