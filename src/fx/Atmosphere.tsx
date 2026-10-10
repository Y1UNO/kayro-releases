import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Backdrop, useTheme, type Quality, type Theme } from "../design";
import { useHub } from "../store";
import { createFx } from "./createFx";
import type { FxLayer, FxPalette } from "./FxLayer";
import { onWindowVisibility } from "../ipc/events";
import { connectFx } from "./target";

interface Props {
  /** Overrides the saved settings (dev pages, catalogue). */
  quality?: Quality;
  intensity?: number;
  /** Other layers than the default ones (dev bench: one layer at a time). Read once, at mount. */
  layers?: () => FxLayer[];
}

export function themePalette(theme: Theme): FxPalette {
  return { beam: theme.beam, fog: theme.fog };
}

/**
 * The full background: theme gradient, animated atmosphere (FxLayer), grain and vignette.
 * Quality and intensity come from the settings; the palette from the theme (step 14: the game's).
 * Paused while the page is hidden (the complete standby — focus lost, game in front — is step 13).
 */
export function Atmosphere({ quality, intensity, layers }: Props) {
  const slot = useRef<HTMLDivElement>(null);
  const [fx, setFx] = useState<FxLayer | null>(null);
  const { theme } = useTheme();
  const savedQuality = useHub((s) => s.settings?.quality);
  const savedIntensity = useHub((s) => s.settings?.atmosphereIntensity);
  const q = quality ?? savedQuality ?? "balanced";
  const k = intensity ?? savedIntensity ?? 1;

  useLayoutEffect(() => {
    const el = slot.current;
    if (!el) return;
    const layer = createFx(layers);
    layer.mount(el);
    setFx(layer);
    connectFx(layer);
    const onVisibility = () => (document.hidden ? layer.pause() : layer.resume());
    document.addEventListener("visibilitychange", onVisibility);
    // WebView2 never fires `visibilitychange` for a window the core hides (spike 01): the core
    // says so itself, and the loops stop for as long as the hub is not on screen.
    const unlistenShown = onWindowVisibility(({ visible }) =>
      visible ? layer.resume() : layer.pause(),
    );
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void unlistenShown.then((off) => off());
      connectFx(null);
      layer.dispose();
      setFx(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once, at mount
  }, []);

  // Palette before quality: the dust starts once it has its sprite colours.
  useLayoutEffect(() => fx?.setPalette(themePalette(theme)), [fx, theme]);
  useLayoutEffect(() => fx?.setQuality(q), [fx, q]);
  useLayoutEffect(() => fx?.setIntensity(k), [fx, k]);

  useEffect(() => {
    if (fx && document.hidden) fx.pause();
  }, [fx]);

  return (
    <Backdrop>
      <div ref={slot} style={{ position: "absolute", inset: 0 }} />
    </Backdrop>
  );
}
