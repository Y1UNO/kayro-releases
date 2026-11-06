import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Backdrop, themeGradient, useTheme, type Quality, type Theme } from "../design";
import { effectiveQuality } from "../design/quality";
import { useDa } from "../design/da";
import { ELEMENTS } from "../design/da/catalogue";
import { parseColor } from "../lib/color";
import { useHub } from "../store";
import { createFx } from "./createFx";
import type { FxLayer, FxPalette, FxTarget } from "./FxLayer";
import { onWindowVisibility } from "../ipc/events";

interface Props {
  /** Overrides the saved settings (dev pages, catalogue). */
  quality?: Quality;
  intensity?: number;
  /** Other layers than the default ones (tests). Read once, at mount. */
  layers?: () => FxLayer[];
  /** Colours other than the theme's (step 14: the selected game's). */
  palette?: FxPalette;
  /**
   * A change to play from `origin` (a new `id` each time): a tide from there, or a fade of the whole
   * screen; null: changes are instant.
   */
  change?: { id: number; origin: FxTarget | null; kind: "tide" | "fade" } | null;
  /**
   * Step 16b: what the light falls on now (the shown card), kept current; null: nothing. A change
   * still starts its tide from its own `origin`.
   */
  focus?: FxTarget | null;
}

function rgbOf(css: string): [number, number, number] {
  const c = parseColor(css);
  return c ? [Math.round(c.r), Math.round(c.g), Math.round(c.b)] : [255, 255, 255];
}

export function themePalette(theme: Theme): FxPalette {
  const [a, b] = themeGradient(theme);
  return { beam: theme.beam, fog: theme.fog, a: rgbOf(a), b: rgbOf(b), bg: theme.bg };
}

/**
 * The full background: theme gradient, animated atmosphere (FxLayer), grain and vignette.
 * Quality and intensity come from the settings; the palette from the theme (step 14: the game's).
 * Paused while the page is hidden (the complete standby — focus lost, game in front — is step 13).
 */
export function Atmosphere({
  quality,
  intensity,
  layers,
  palette,
  change = null,
  focus = null,
}: Props) {
  const slot = useRef<HTMLDivElement>(null);
  const [fx, setFx] = useState<FxLayer | null>(null);
  const { theme } = useTheme();
  const savedQuality = useHub((s) => s.settings?.quality);
  const savedIntensity = useHub((s) => s.settings?.atmosphereIntensity);
  const q = quality ?? effectiveQuality(savedQuality);
  const k = intensity ?? savedIntensity ?? 1;
  const params = useDa((s) => s.values);

  useLayoutEffect(() => {
    const el = slot.current;
    if (!el) return;
    const layer = createFx(layers);
    layer.mount(el);
    setFx(layer);
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
      layer.dispose();
      setFx(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once, at mount
  }, []);

  // Params and palette before quality: the particles start once they have their sprite colours.
  useLayoutEffect(() => fx?.setParams(params), [fx, params]);
  // Step 16b: the focus target, before the palette (a fresh change then sets its own origin).
  useLayoutEffect(() => fx?.setFocusTarget(focus), [fx, focus]);
  // Step 14: a new change plays the tide from its card; the rest (theme, setting) is instant.
  const played = useRef(0);
  useLayoutEffect(() => {
    if (!fx) return;
    const fresh = change !== null && change.id !== played.current;
    if (change) played.current = change.id;
    if (fresh) fx.setFocusTarget(change.origin);
    fx.setPalette({
      ...(palette ?? themePalette(theme)),
      passage: fresh ? change.kind : "instant",
    });
  }, [fx, theme, palette, change]);
  useLayoutEffect(() => fx?.setQuality(q), [fx, q]);
  useLayoutEffect(() => fx?.setIntensity(k), [fx, k]);

  useEffect(() => {
    if (fx && document.hidden) fx.pause();
  }, [fx]);

  // Step 14, CSS fallback: the immersive night of a game, on the backdrop (the engine draws its own).
  const night = palette?.bg?.some((c, i) => c !== theme.bg[i]) ? palette.bg : null;
  const shape = params.backdrop;
  const backdrop = useMemo((): CSSProperties | undefined => {
    if (!night) return undefined;
    const da = ELEMENTS.get("backdrop")?.css?.(shape ?? { on: true }) ?? {};
    const vars = { "--bg-top": night[0], "--bg-mid": night[1], "--bg-bottom": night[2] };
    return { ...vars, "--da-bg": da["--da-bg"] } as CSSProperties;
  }, [night, shape]);

  return (
    <Backdrop style={backdrop}>
      <div ref={slot} style={{ position: "absolute", inset: 0 }} />
    </Backdrop>
  );
}
