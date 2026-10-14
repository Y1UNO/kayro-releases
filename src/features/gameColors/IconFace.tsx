import { memo } from "react";
import { useTheme } from "../../design";
import type { AppColors, Palette } from "../../ipc/bindings";
import { paletteOf, useArt, useHub } from "../../store";
import { cssVars } from "../home/cssVars";
import { deriveGameColors, faceColors } from "./derive";
import { useColorSettings } from "./useGameColors";

interface Props {
  id: string;
  /** Where between A and B this card's face sits (a draw per app, cardLook.ts), %. */
  mix: number;
  className?: string;
}

/** The theme's A → B face (the look of round 5). */
function plain(className: string | undefined, mix: number) {
  return <span className={className} style={cssVars({ "--mix": `${mix}%` })} />;
}

/** A face in the app's colours: the only faces that follow the theme and the settings. */
function TintedFace({
  className,
  mix,
  own,
  icon,
}: Omit<Props, "id"> & { own: AppColors | null; icon: Palette | null }) {
  const { theme } = useTheme();
  const cs = useColorSettings();
  const choice = { intensity: cs.intensity, character: cs.character, pick: cs.pick };
  let pair: readonly [string, string] | null = null;
  if (cs.mode !== "off") {
    if (own?.mode === "chosen") {
      const c = deriveGameColors(theme, null, "light", choice, own);
      pair = c ? [c.a, c.b] : null;
    } else if (icon && cs.fromIcon) pair = faceColors(theme, icon, choice);
  }
  if (!pair) return plain(className, mix);
  return (
    <span
      className={className}
      style={cssVars({ "--mix": `${mix}%`, "--grad-a": pair[0], "--grad-b": pair[1] })}
    />
  );
}

/**
 * Step 14 (V10 b): the face of a card without a picture, in its icon's colours or the colours chosen
 * for the app (bounded and mixed with the theme like a game's); otherwise the theme's. Only the
 * cards that can be tinted subscribe to the theme and the settings (measured 14/10: every card
 * re-rendered at each theme change).
 */
export const IconFace = memo(function IconFace({ id, mix, className }: Props) {
  const own = useHub((s) => s.apps.find((a) => a.id === id)?.colors ?? null);
  const icon = useArt((s) => paletteOf(s, id, "icon")?.palette ?? null);
  const tinted = own?.mode === "chosen" || (icon !== null && own?.mode !== "theme");
  if (!tinted) return plain(className, mix);
  return <TintedFace className={className} mix={mix} own={own} icon={icon} />;
});
