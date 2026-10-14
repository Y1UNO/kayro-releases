import { themeGradient, type Theme } from "../../design";
import type { FxPalette } from "../../fx";
import type {
  AppColors,
  ColorCharacter,
  ColorIntensity,
  ColorMode,
  ColorPick,
  Palette,
  PaletteColor,
} from "../../ipc/bindings";
import {
  chromaOf,
  hexToLab,
  hexToRgb,
  hueGap,
  hueOf,
  labToHex,
  mixLab,
  type Lab,
} from "../../lib/oklab";

/**
 * How a game's palette becomes Kayro's colours (step 14). The core gives raw colours (OKLab, with
 * their share and four roles); here they are picked, bounded like the themes' own colours and mixed
 * with the theme. Defaults = the board (DA-JOURNAL, 14/10): V1 b, V5 a, V6 a; the other variants are
 * the « Personnalisation avancée » (settings `colorIntensity`, `colorCharacter`, `colorPick`).
 */
export interface ColorChoice {
  /** V1: share of the game's colour mixed into the theme. */
  intensity: ColorIntensity;
  /** V6: bounds of lightness and chroma. */
  character: ColorCharacter;
  /** V5: which colours become A and B. */
  pick: ColorPick;
}

export const DEFAULT_CHOICE: ColorChoice = {
  intensity: "normal",
  character: "theme",
  pick: "dominant",
};

const MIX: Record<ColorChoice["intensity"], number> = { soft: 0.35, normal: 0.6, strong: 1 };

/** V6 a = the lightness and chroma of the six themes' A and B. */
const BOUNDS: Record<ColorChoice["character"], { lMin: number; lMax: number; cMax: number }> = {
  theme: { lMin: 0.72, lMax: 0.85, cMax: 0.12 },
  vivid: { lMin: 0.68, lMax: 0.85, cMax: 0.18 },
  faithful: { lMin: 0.62, lMax: 0.95, cMax: 0.37 },
};

/** The night of the immersive mode, top → bottom (lightness), and its largest chroma. */
const NIGHT_L = [0.22, 0.155, 0.09] as const;
const NIGHT_C = 0.045;

/** The palettes a game's colours come from: its main image, and its other one if any. */
export interface GameSource {
  main: Palette;
  other: Palette | null;
}

/** The game's colours: A and B (hex), and the immersive night (null in « Léger »). */
export interface GameColors {
  a: string;
  b: string;
  night: [string, string, string] | null;
}

/** OKLab of a colour of the core (a NaN would come as null: read as 0, never thrown). */
const lab = (c: PaletteColor): Lab => [c.l ?? 0, c.a ?? 0, c.b ?? 0];

function bounded(c: Lab, character: ColorChoice["character"]): Lab {
  const k = BOUNDS[character];
  const L = Math.min(k.lMax, Math.max(k.lMin, c[0]));
  const C = Math.min(k.cMax, chromaOf(c));
  const h = hueOf(c);
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

/** One colour of a palette: the accent, unless it is the dominant one (an image of one colour). */
function accentOf(p: Palette | null): Lab | null {
  if (!p || p.accent === p.dominant) return null;
  const c = p.colors[p.accent];
  return c ? lab(c) : null;
}

function vividOrder(p: Palette): Lab[] {
  return p.colors
    .map((c) => ({ c: lab(c), score: Math.sqrt(c.weight ?? 0) * chromaOf(lab(c)) }))
    .sort((x, y) => y.score - x.score)
    .map((x) => x.c);
}

/**
 * A and B of a game (V5), raw. The user's rule (14/10): an image of one colour takes its accent
 * from the game's other image (poster or hero), else from the theme.
 */
export function gamePair(source: GameSource, themeB: Lab, pick: ColorChoice["pick"]): [Lab, Lab] {
  const { main, other } = source;
  const dom = main.colors[main.dominant];
  const d = dom ? lab(dom) : themeB;
  const acc = accentOf(main) ?? accentOf(other) ?? themeB;
  if (pick === "theme") return [d, themeB];
  if (pick === "vivid") {
    const [first, ...rest] = vividOrder(main);
    if (!first) return [d, acc];
    return [first, rest.find((c) => hueGap(c, first) >= 25) ?? acc];
  }
  return [d, acc];
}

/**
 * The game's colours for a theme, or null when the theme's own apply (mode off, no palette, or the
 * app set to « thème »). The app's own choice (`AppColors`, its edit dialog) replaces the automatic
 * pick only: its two colours are bounded and mixed like the others.
 */
export function deriveGameColors(
  theme: Theme,
  source: GameSource | null,
  mode: ColorMode,
  choice: ColorChoice = DEFAULT_CHOICE,
  own: AppColors | null = null,
): GameColors | null {
  if (mode === "off" || own?.mode === "theme") return null;
  const chosen = own?.mode === "chosen" ? own : null;
  if (!source && !chosen) return null;
  const [ta, tb] = themeGradient(theme).map(hexToLab) as [Lab, Lab];
  const t = MIX[choice.intensity];
  const [rawA, rawB] = chosen
    ? [hexToLab(chosen.a), hexToLab(chosen.b)]
    : gamePair(source!, tb, choice.pick);
  const a = labToHex(mixLab(ta, bounded(rawA, choice.character), t));
  const b = labToHex(mixLab(tb, bounded(rawB, choice.character), t));
  if (mode !== "immersive") return { a, b, night: null };
  // The night takes the hue of the dominant colour (or of A when the dominant one is grey).
  const dom = chosen || !source ? undefined : source.main.colors[source.main.dominant];
  const hueFrom = dom && chromaOf(lab(dom)) > 0.02 ? lab(dom) : rawA;
  const C = Math.min(NIGHT_C, chromaOf(hueFrom));
  const h = hueOf(hueFrom);
  const night = NIGHT_L.map((L, i) =>
    labToHex(mixLab(hexToLab(theme.bg[i]!), [L, C * Math.cos(h), C * Math.sin(h)], t)),
  ) as [string, string, string];
  return { a, b, night };
}

/** The face of a card without a picture in its icon's colours (V10 b): A and B, hex. */
export function faceColors(theme: Theme, icon: Palette, choice: ColorChoice = DEFAULT_CHOICE) {
  const c = deriveGameColors(theme, { main: icon, other: null }, "light", choice);
  return c ? ([c.a, c.b] as const) : null;
}

/** A theme whose colours are the game's: the contrast tests read it like a real theme. */
export function withGameColors(theme: Theme, c: GameColors): Theme {
  return {
    ...theme,
    accent: c.a,
    gradient: [c.a, c.b],
    card: [...hexToRgb(c.a)] as [number, number, number],
    bg: c.night ?? theme.bg,
  };
}

export interface PaletteExtras {
  /** Immersive mode: the game's hero picture, drawn by the engine (see `FxPalette.hero`). */
  hero: FxPalette["hero"];
  /** How the engine goes from the previous palette (step 14). */
  passage: "tide" | "instant";
}

/** The engine's palette: the theme's, or the game's colours over it. */
export function gamePalette(theme: Theme, c: GameColors | null, extras: PaletteExtras): FxPalette {
  const [ta, tb] = themeGradient(theme);
  const a = hexToRgb(c?.a ?? ta);
  const b = hexToRgb(c?.b ?? tb);
  return {
    beam: c ? b : theme.beam,
    fog: theme.fog,
    a,
    b,
    card: c ? a : theme.card,
    bg: c?.night ?? theme.bg,
    hero: extras.hero,
    passage: extras.passage,
  };
}
