import { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Theme } from "../../design";
import type { FxPalette, FxTarget } from "../../fx";
import type { AppPalette, ArtImage } from "../../ipc/bindings";
import { useArt, useHub } from "../../store";
import { artUrl } from "../home/art";
import { deriveGameColors, type GameColors, type GameSource } from "./derive";
import { gameColorsStore } from "./store";

export interface GameColorsView {
  /** The game's colours, or null when the theme's apply. */
  colors: GameColors | null;
  hero: FxPalette["hero"];
  /** The last change plays the tide, from `origin`, started at `since`. */
  tide: boolean;
  origin: FxTarget | null;
  since: number;
}

/** Poster first (with the hero as its other image), else the hero, else the icon (V10 b). */
export function sourceOf(list: readonly AppPalette[] | undefined): GameSource | null {
  const of = (s: AppPalette["source"]) => list?.find((p) => p.source === s)?.palette ?? null;
  const poster = of("poster");
  const hero = of("hero");
  if (poster) return { main: poster, other: hero };
  if (hero) return { main: hero, other: null };
  const icon = of("icon");
  return icon ? { main: icon, other: null } : null;
}

/** Immersive night's picture (V3 b): Steam's blurred hero, else the hero blurred by the engine. */
export function heroOf(id: string, images: readonly ArtImage[] | undefined): FxPalette["hero"] {
  const blur = images?.find((i) => i.role === "heroBlur");
  const sharp = images?.find((i) => i.role === "hero");
  if (blur) return { url: artUrl(id, blur), blurred: true };
  return sharp ? { url: artUrl(id, sharp), blurred: false } : null;
}

/** The colours of the shown app for `theme`, live (store, palettes, setting « Couleurs du jeu »). */
export function useGameColors(theme: Theme): GameColorsView {
  const { shown, origin, since, tide } = useStore(
    gameColorsStore,
    useShallow((s) => s),
  );
  const mode = useHub((s) => s.settings?.colorMode ?? "light");
  const palettes = useArt((s) => (shown ? s.palettes[shown] : undefined));
  const images = useArt((s) => (shown ? s.byId[shown] : undefined));
  return useMemo(() => {
    const colors = deriveGameColors(theme, sourceOf(palettes), mode);
    const hero = mode === "immersive" && shown && colors ? heroOf(shown, images) : null;
    return { colors, hero, tide, origin, since };
  }, [theme, palettes, mode, shown, images, tide, origin, since]);
}
