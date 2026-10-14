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

/** The colours of the shown app for `theme`, live (store, palettes, settings, the app's choice). */
export function useGameColors(theme: Theme): GameColorsView {
  const { shown, origin, since, tide } = useStore(
    gameColorsStore,
    useShallow((s) => s),
  );
  const settings = useHub((s) => s.settings);
  const own = useHub((s) => (shown ? s.apps.find((a) => a.id === shown)?.colors : null) ?? null);
  const palettes = useArt((s) => (shown ? s.palettes[shown] : undefined));
  const images = useArt((s) => (shown ? s.byId[shown] : undefined));
  return useMemo(() => {
    const mode = settings?.colorMode ?? "light";
    const choice = {
      intensity: settings?.colorIntensity ?? DEFAULT_CHOICE.intensity,
      character: settings?.colorCharacter ?? DEFAULT_CHOICE.character,
      pick: settings?.colorPick ?? DEFAULT_CHOICE.pick,
    };
    const source = sourceOf(palettes, settings?.colorFromIcon ?? true);
    const colors = deriveGameColors(theme, source, mode, choice, own);
    const showHero = mode === "immersive" && (settings?.colorHero ?? true);
    const hero = showHero && shown && colors ? heroOf(shown, images) : null;
    const passage = settings?.colorPassage ?? "tide";
    return { colors, hero, tide, origin, since, passage };
  }, [theme, settings, own, palettes, shown, images, tide, origin, since]);
}
