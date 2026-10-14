import { useMemo } from "react";
import { useTheme } from "../../design";
import { paletteOf, useArt, useHub } from "../../store";
import { DEFAULT_CHOICE, deriveGameColors, faceColors } from "./derive";

/**
 * Step 14 (V10 b): a card without a picture takes its icon's colours for its A → B face (bounded
 * and mixed with the theme like a game's), or the colours chosen for the app in its edit dialog.
 * Null: the theme's face (« Couleurs du jeu » off, the app set to « thème », « Apps sans image »
 * on the theme, no icon palette, or a picture shown instead).
 */
export function useIconFace(id: string, hasPicture: boolean): readonly [string, string] | null {
  const { theme } = useTheme();
  const settings = useHub((s) => s.settings);
  const own = useHub((s) => s.apps.find((a) => a.id === id)?.colors ?? null);
  const icon = useArt((s) => paletteOf(s, id, "icon")?.palette ?? null);
  return useMemo(() => {
    if (hasPicture || (settings?.colorMode ?? "light") === "off" || own?.mode === "theme")
      return null;
    const choice = {
      intensity: settings?.colorIntensity ?? DEFAULT_CHOICE.intensity,
      character: settings?.colorCharacter ?? DEFAULT_CHOICE.character,
      pick: settings?.colorPick ?? DEFAULT_CHOICE.pick,
    };
    if (own?.mode === "chosen") {
      const c = deriveGameColors(theme, null, "light", choice, own);
      return c ? ([c.a, c.b] as const) : null;
    }
    if (!icon || settings?.colorFromIcon === false) return null;
    return faceColors(theme, icon, choice);
  }, [theme, settings, own, icon, hasPicture]);
}
