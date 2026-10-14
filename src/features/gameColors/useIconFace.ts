import { useMemo } from "react";
import { useTheme } from "../../design";
import { paletteOf, useArt, useHub } from "../../store";
import { faceColors } from "./derive";

/**
 * Step 14 (V10 b): a card without a picture takes its icon's colours for its A → B face (bounded
 * and mixed with the theme like a game's). Null: the theme's face (setting off, no icon palette,
 * or a picture shown instead).
 */
export function useIconFace(id: string, hasPicture: boolean): readonly [string, string] | null {
  const { theme } = useTheme();
  const mode = useHub((s) => s.settings?.colorMode ?? "light");
  const icon = useArt((s) => paletteOf(s, id, "icon")?.palette ?? null);
  return useMemo(
    () => (hasPicture || !icon || mode === "off" ? null : faceColors(theme, icon)),
    [theme, icon, mode, hasPicture],
  );
}
