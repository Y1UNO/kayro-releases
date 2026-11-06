import { contrastRatio, parseColor } from "../../lib/color";
import {
  chromaOf,
  hexToLab,
  hueOf,
  labToHex,
  labToRgb,
  rgbToHex,
  rgbToLab,
  type Lab,
} from "../../lib/oklab";
import { contrastPairs } from "../contrast";
import type { Theme } from "../theme";

/**
 * « Créer mon thème » (step 15): a whole theme from two colours and a background. The built-in
 * themes all follow one rule, measured in OKLab on the six of them, and this replays it:
 * - accent, cards and the first fog = A; the beam, the glow and the last fog = B;
 * - soft text = A lighter (+0.12) and half as coloured;
 * - the three backgrounds = A's hue, at the built-ins' lightness (0.215 → 0.165 → 0.127), more
 *   or less tinted (`tint` 0 = ink like Encre, 1 = as coloured as Lavande-pêche).
 * A and B are bounded like the built-ins' (no neon, readable dark text on the accent); the
 * contrast of every text pair is then checked, and A lightened until it passes.
 */
export interface ThemeRecipe {
  name: string;
  /** Colour A (hex), B (hex), as picked. */
  a: string;
  b: string;
  /** How tinted the background is, 0–1. */
  tint: number;
}

export const TINT_DEFAULT = 0.7;
const A_BOUNDS = { l: [0.72, 0.84], c: 0.12 } as const;
const B_BOUNDS = { l: [0.62, 0.82], c: 0.14 } as const;
const BG_L = [0.215, 0.165, 0.127] as const;
const BG_C_INK = [0.01, 0.007, 0.005] as const;
const BG_C_TINTED = [0.052, 0.035, 0.021] as const;
const MIN_RATIO = 4.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function polar(l: number, c: number, h: number): Lab {
  return [l, c * Math.cos(h), c * Math.sin(h)];
}

/** A colour moved into bounds (lightness, chroma), hue kept. */
function bounded(hex: string, b: { l: readonly [number, number]; c: number }): Lab {
  const lab = hexToLab(hex);
  return polar(clamp(lab[0], b.l[0], b.l[1]), Math.min(chromaOf(lab), b.c), hueOf(lab));
}

const rgba = (lab: Lab, alpha: number) => `rgba(${labToRgb(lab).join(",")},${alpha})`;

function build(id: string, r: ThemeRecipe, A: Lab, B: Lab): Theme {
  const h = hueOf(A);
  const tint = clamp(r.tint, 0, 1);
  const bg = BG_L.map((l, i) =>
    labToHex(polar(l, BG_C_INK[i]! + (BG_C_TINTED[i]! - BG_C_INK[i]!) * tint, h)),
  ) as [string, string, string];
  const a = labToHex(A);
  const b = labToHex(B);
  return {
    schemaVersion: 1,
    id,
    name: r.name.trim() || "Mon thème",
    author: "Moi",
    description: "Thème personnel.",
    bg,
    accent: a,
    glow: rgba(B, 0.35),
    fog: [rgba(A, 0.34), rgba(A, 0.16), rgba(B, 0.14)],
    card: [...labToRgb(A)],
    beam: [...labToRgb(B)],
    gradient: [a, b],
    soft: labToHex(polar(clamp(A[0] + 0.12, 0.88, 0.93), chromaOf(A) * 0.5, h)),
  };
}

/** True when every text pair of the theme reads at 4.5:1 at least. */
export function readable(theme: Theme): boolean {
  return contrastPairs(theme).every((p) => contrastRatio(p.fg, p.bg) >= MIN_RATIO);
}

/** The theme of a recipe (id given by the core for a new one). */
export function deriveTheme(id: string, recipe: ThemeRecipe): Theme {
  const A = bounded(recipe.a, A_BOUNDS);
  const B = bounded(recipe.b, B_BOUNDS);
  const first = build(id, recipe, A, B);
  if (readable(first)) return first;
  // Dark text sits on the accent, light text on its fog: the nearest lightness (then a calmer
  // chroma) that suits both.
  for (const k of [1, 0.75, 0.5]) {
    for (let step = 1; step <= 10; step++) {
      for (const sign of [-1, 1]) {
        const l = clamp(A[0] + sign * step * 0.02, 0.6, 0.92);
        const t = build(id, recipe, polar(l, chromaOf(A) * k, hueOf(A)), B);
        if (readable(t)) return t;
      }
    }
  }
  return first;
}

/** The recipe a personal theme was made from (to edit it again). */
export function recipeOf(theme: Theme): ThemeRecipe {
  // An imported theme may have no gradient: its accent and its beam are its A and B.
  const [a, b] = theme.gradient ?? [theme.accent, rgbToHex(theme.beam)];
  const p = parseColor(theme.bg[1]);
  const mid = p ? rgbToLab([p.r, p.g, p.b]) : hexToLab("#0b0f1e");
  const tint = (chromaOf(mid) - BG_C_INK[1]) / (BG_C_TINTED[1] - BG_C_INK[1]);
  return { name: theme.name, a, b, tint: clamp(Math.round(tint * 20) / 20, 0, 1) };
}
