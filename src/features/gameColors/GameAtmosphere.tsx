import { useMemo } from "react";
import { useTheme } from "../../design";
import { Atmosphere } from "../../fx";
import { gamePalette } from "./derive";
import { useGameColors } from "./useGameColors";

/**
 * The atmosphere in the colours of the selected game (step 14): the theme's when « Couleurs du jeu »
 * is off, on the fan or without a palette. A new selection spreads as a tide from its card.
 */
export function GameAtmosphere() {
  const { theme } = useTheme();
  const view = useGameColors(theme);
  const palette = useMemo(
    () => gamePalette(theme, view.colors, { hero: view.hero, passage: "instant" }),
    [theme, view.colors, view.hero],
  );
  const change = useMemo(
    () => (view.tide ? { id: view.since, origin: view.origin } : null),
    [view.tide, view.since, view.origin],
  );
  return <Atmosphere palette={palette} change={change} />;
}
