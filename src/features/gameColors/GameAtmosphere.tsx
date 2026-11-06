import { useMemo } from "react";
import { useStore } from "zustand";
import { useTheme } from "../../design";
import { Atmosphere } from "../../fx";
import { useShownLook } from "../moods/useShownLook";
import { gamePalette } from "./derive";
import { gameColorsStore } from "./store";
import { useGameColors } from "./useGameColors";

/**
 * The atmosphere in the colours of the selected game (step 14): the theme's when « Couleurs du jeu »
 * is off, on the fan or without a palette. A new selection spreads as a tide from its card; the
 * shown card is the atmosphere's focus target (step 16b), kept current.
 */
export function GameAtmosphere() {
  const { theme } = useTheme();
  const view = useGameColors(theme);
  // Steps 16–17: the shown app's ambience and special card (its background shown in Léger too).
  const look = useShownLook();
  const palette = useMemo(
    () => ({
      ...gamePalette(theme, view.colors, { hero: look.hero, passage: "instant" }),
      mood: look.mood,
      special: look.special,
    }),
    [theme, view.colors, look],
  );
  // « Direct » plays nothing: every change is instant.
  const kind: "tide" | "fade" = view.passage === "fade" ? "fade" : "tide";
  const change = useMemo(
    () =>
      view.tide && view.passage !== "direct" ? { id: view.since, origin: view.origin, kind } : null,
    [view.tide, view.since, view.origin, view.passage, kind],
  );
  const focus = useStore(gameColorsStore, (s) => s.focus);
  return <Atmosphere palette={palette} change={change} focus={focus} />;
}
