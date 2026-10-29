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
import { chromaOf, hexToLab, hexToRgb, hueGap, hueOf, labToHex, type Lab } from "../../lib/oklab";
import { GREY_C, hueFamilies, SECOND_MIN } from "./palettePick";

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

/**
 * Share of the game's colour (review 2026-10-29: 0.35 / 0.6 → 0.55 / 0.85, mixed round the hue
 * circle: the game leads, the theme only softens it).
 */
const MIX: Record<ColorChoice["intensity"], number> = { soft: 0.55, normal: 0.85, strong: 1 };

/** V6 a = the lightness and chroma of the six themes' A and B. */
const BOUNDS: Record<ColorChoice["character"], { lMin: number; lMax: number; cMax: number }> = {
  theme: { lMin: 0.72, lMax: 0.85, cMax: 0.12 },
  vivid: { lMin: 0.68, lMax: 0.85, cMax: 0.18 },
  faithful: { lMin: 0.62, lMax: 0.95, cMax: 0.37 },
};

/** The night of the immersive mode, top → bottom (lightness), and its largest chroma. */
const NIGHT_L = [0.22, 0.155, 0.09] as const;
const NIGHT_C = 0.055;
/**
 * Review 2026-10-29: in « Léger » the night takes the game's hue too, at this share of the
 * immersive one (the user saw no change from one game to the next with the night left alone).
 */
const LIGHT_NIGHT = 0.55;
/** The dominant colour speaks for the image only above this chroma (a night-blue sky does not). */
const DOMINANT_C = 0.05;
/** A colour must cover this share of the image to speak for it. */
const MIN_WEIGHT = 0.06;

/** The palettes a game's colours come from: its main image, and its other one if any. */
export interface GameSource {
  main: Palette;
  other: Palette | null;
}

/** The game's colours: A and B (hex), and the night (lighter-handed in « Léger »). */
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

/**
 * Mixes two colours round the hue circle (review 2026-10-29): lightness and chroma in a line, the
 * hue the short way round. A straight OKLab line between two far hues (the theme's peach, Apex's
 * cyan) passes through grey: the user saw a grey hub on a blue game.
 */
export function mixLch(p: Lab, q: Lab, t: number): Lab {
  const [cp, cq] = [chromaOf(p), chromaOf(q)];
  let hp = hueOf(p);
  let hq = hueOf(q);
  if (cp < 0.01) hp = hq;
  if (cq < 0.01) hq = hp;
  let d = hq - hp;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  const h = hp + d * t;
  const C = cp + (cq - cp) * t;
  return [p[0] + (q[0] - p[0]) * t, C * Math.cos(h), C * Math.sin(h)];
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
 * The colour that speaks for an image (review 2026-10-29): its dominant one, unless that one is a
 * grey or a near black (most posters: a dark sky behind the hero); then the most present colour
 * that has a hue.
 */
export function characterOf(p: Palette): Lab | null {
  const dom = p.colors[p.dominant];
  if (dom && chromaOf(lab(dom)) >= DOMINANT_C) return lab(dom);
  let best: Lab | null = null;
  let score = 0;
  for (const c of p.colors) {
    const l = lab(c);
    const s = Math.sqrt(c.weight ?? 0) * chromaOf(l);
    if ((c.weight ?? 0) >= MIN_WEIGHT && chromaOf(l) >= GREY_C && s > score) {
      best = l;
      score = s;
    }
  }
  return best ?? (dom ? lab(dom) : null);
}

/** B must not repeat A: the accent, else the most vivid colour of another hue (≥ 25°). */
function apart(a: Lab, acc: Lab, p: Palette): Lab {
  if (chromaOf(acc) < GREY_C || chromaOf(a) < GREY_C || hueGap(acc, a) >= 25) return acc;
  return vividOrder(p).find((c) => chromaOf(c) >= GREY_C && hueGap(c, a) >= 25) ?? acc;
}

/**
 * A and B of a game (V5), raw. « Dominante » (review 2026-10-29): the two strongest hue families of
 * its poster and hero (`palettePick.ts`); a game without colour (a grey poster) falls back on the
 * colour that speaks for its image. The user's rule (14/10) stays: an image of one colour takes its
 * accent from the game's other image, else from the theme.
 */
export function gamePair(source: GameSource, themeB: Lab, pick: ColorChoice["pick"]): [Lab, Lab] {
  const { main, other } = source;
  const fams = hueFamilies([
    { palette: main, weight: 1 },
    ...(other ? [{ palette: other, weight: 0.5 }] : []),
  ]);
  const d = fams[0]?.colour ?? characterOf(main) ?? themeB;
  const second = fams[1] && fams[1].score >= SECOND_MIN * fams[0]!.score ? fams[1].colour : null;
  const acc = second ?? apart(d, accentOf(main) ?? accentOf(other) ?? themeB, main);
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
  const a = labToHex(mixLch(ta, bounded(rawA, choice.character), t));
  const b = labToHex(mixLch(tb, bounded(rawB, choice.character), t));
  // The night takes A's hue (review 2026-10-29: was the dominant colour's, often a grey sky); in
  // « Léger » at a share of the immersive one (LIGHT_NIGHT).
  const C = Math.min(NIGHT_C, chromaOf(rawA));
  const h = hueOf(rawA);
  const share = mode === "immersive" ? t : t * LIGHT_NIGHT;
  const night = NIGHT_L.map((L, i) =>
    labToHex(mixLch(hexToLab(theme.bg[i]!), [L, C * Math.cos(h), C * Math.sin(h)], share)),
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
