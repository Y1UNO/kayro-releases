/**
 * Catalogue of the visual elements of the art direction (step 12b). Every tunable look of the
 * app is declared here: its parameters (bounds, default), its estimated cost, whether it is on.
 * The workshop (`/dev/atelier`) builds its controls from this list; presets and `active.json`
 * only hold values. Adding or removing an element = this file + one isolated module (an FxLayer
 * or a few CSS variables). French labels live in the dev-only workshop (`src/dev/atelier`).
 *
 * Two kinds of consumers:
 *  - `css`: the element writes CSS variables on <html> (screens: cards, glass, titles…);
 *  - `fx`: the atmosphere layers read the values through `FxLayer.setParams`.
 */

export type DaValue = number | boolean | string;
/** Values of one element: `on` plus one entry per parameter. */
export type ElementValues = { readonly on: boolean } & Readonly<Record<string, DaValue>>;
/** Values of every element, by element id. */
export type DaValues = Readonly<Record<string, ElementValues>>;

export interface RangeParam {
  kind: "range";
  key: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}
export interface ToggleParam {
  kind: "toggle";
  key: string;
  default: boolean;
}
export interface SelectParam {
  kind: "select";
  key: string;
  options: readonly string[];
  default: string;
}
/** `""` = the theme's colour; otherwise `#rrggbb`. */
export interface ColorParam {
  kind: "color";
  key: string;
  default: string;
}
export type DaParam = RangeParam | ToggleParam | SelectParam | ColorParam;

export type DaGroup = "fond" | "particules" | "interface" | "mouvement" | "historique";
export type DaCost = "faible" | "moyen" | "élevé";

export interface DaElement {
  id: string;
  group: DaGroup;
  cost: DaCost;
  defaultOn: boolean;
  params: readonly DaParam[];
  /** Read by the atmosphere layers (FxLayer.setParams). */
  fx?: true;
  /** CSS variables written on <html>. Called with the element's values, `on` included. */
  css?: (v: ElementValues) => Record<string, string>;
}

const range = (
  key: string,
  min: number,
  max: number,
  step: number,
  def: number,
  unit?: string,
): RangeParam => ({ kind: "range", key, min, max, step, default: def, unit });
const toggle = (key: string, def: boolean): ToggleParam => ({ kind: "toggle", key, default: def });
const select = (key: string, options: readonly string[], def: string): SelectParam => ({
  kind: "select",
  key,
  options,
  default: def,
});
const color = (key: string, def = ""): ColorParam => ({ kind: "color", key, default: def });

/** No CSS variable (element off: the stylesheet fallbacks apply). */
const NONE: Record<string, string> = {};
const n = (v: ElementValues, k: string) => v[k] as number;
const px = (v: ElementValues, k: string) => `${n(v, k)}px`;

/** Curves offered for UI motion (`ease` select). */
export const EASES: Readonly<Record<string, string>> = {
  douce: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  premium: "cubic-bezier(0.22, 1, 0.36, 1)",
  ressort: "cubic-bezier(0.34, 1.36, 0.64, 1)",
  lineaire: "linear",
};

/** Font pairs (`typography.pair`): titles / interface. Both are bundled (no CDN). */
export const FONT_PAIRS: Readonly<Record<string, { title: string; ui: string }>> = {
  kayro: {
    title: '"Cormorant Garamond Variable", Georgia, serif',
    ui: '"Manrope Variable", system-ui, sans-serif',
  },
  historique: {
    title: '"Fraunces Variable", Georgia, serif',
    ui: '"DM Sans Variable", system-ui, sans-serif',
  },
};

export const CATALOGUE: readonly DaElement[] = [
  // ---- Background ("velours lunaire", mock-up R2-Mix-V4) ----
  {
    id: "backdrop",
    group: "fond",
    cost: "faible",
    defaultOn: true,
    params: [
      select("shape", ["radial", "lineaire"], "radial"),
      range("vignette", 0, 1, 0.01, 0.55),
      range("grain", 0, 0.2, 0.01, 0.09),
    ],
    css: (v) => ({
      "--da-bg":
        v.on && v.shape === "radial"
          ? "radial-gradient(90% 75% at 50% 0%, var(--bg-top) 0%, var(--bg-mid) 50%, var(--bg-bottom) 100%)"
          : "linear-gradient(180deg, var(--bg-top) 0%, var(--bg-mid) 55%, var(--bg-bottom) 100%)",
      "--da-vignette": String(v.on ? n(v, "vignette") : 0.62),
      "--da-grain": String(v.on ? n(v, "grain") : 0.09),
    }),
  },
  {
    id: "moonHalo",
    group: "fond",
    cost: "faible",
    defaultOn: true,
    fx: true,
    params: [
      range("size", 200, 1200, 10, 600, "px"),
      range("top", -600, 400, 5, -170, "px"),
      range("intensity", 0, 0.8, 0.01, 0.34),
      range("breathe", 0, 0.1, 0.005, 0.04),
      range("period", 3, 30, 0.5, 9, "s"),
    ],
  },
  {
    id: "veils",
    group: "fond",
    cost: "faible",
    defaultOn: true,
    fx: true,
    params: [
      range("intensityA", 0, 0.5, 0.01, 0.16),
      range("intensityB", 0, 0.5, 0.01, 0.14),
      range("topA", 0, 100, 1, 43, "%"),
      range("topB", 0, 100, 1, 60, "%"),
      range("amplitude", 0, 200, 5, 80, "px"),
      range("periodA", 8, 90, 1, 30, "s"),
      range("periodB", 8, 90, 1, 36, "s"),
    ],
  },
  {
    id: "crystalRing",
    group: "fond",
    cost: "moyen",
    defaultOn: true,
    fx: true,
    params: [
      range("size", 300, 1400, 10, 680, "px"),
      range("top", -800, 400, 5, -230, "px"),
      range("offsetX", -600, 600, 5, 0, "px"),
      range("band", 4, 30, 1, 12, "px"),
      range("edge", 0, 1, 0.01, 0.42),
      range("fringe", 0, 1, 0.01, 0.5),
      range("glow", 0, 0.6, 0.01, 0.18),
      range("spec", 0, 1, 0.01, 0.9),
      range("period", 10, 120, 1, 40, "s"),
      range("frost", 0, 12, 0.5, 5, "px"),
    ],
  },
  {
    // Spike (step 12b): WebGL2 ring with real refraction; geometry from `crystalRing`.
    id: "ringGpu",
    group: "fond",
    cost: "élevé",
    defaultOn: false,
    fx: true,
    params: [
      range("refraction", 0, 1, 0.01, 0.5),
      range("dispersion", 0, 1, 0.01, 0.35),
      range("blur", 0, 1, 0.01, 0),
      range("spec", 0, 1, 0.01, 0.8),
      select("quality", ["high", "balanced", "eco"], "high"),
    ],
  },
  // ---- Particles (piste P2 « Deux lumières ») ----
  {
    id: "embers",
    group: "particules",
    cost: "moyen",
    defaultOn: true,
    fx: true,
    params: [
      range("count", 0, 40, 1, 20),
      range("size", 1, 8, 0.1, 3.2, "px"),
      range("rise", 60, 600, 10, 220, "px"),
      range("life", 3, 20, 0.5, 9, "s"),
      range("glow", 0, 20, 1, 8, "px"),
      range("zoneX", 0, 100, 1, 50, "%"),
      range("zoneW", 10, 100, 1, 53, "%"),
      range("zoneTop", 0, 100, 1, 71, "%"),
      range("zoneH", 5, 100, 1, 26, "%"),
      color("color"),
    ],
  },
  {
    id: "stars",
    group: "particules",
    cost: "faible",
    defaultOn: true,
    fx: true,
    params: [
      range("count", 0, 40, 1, 24),
      range("size", 0.5, 5, 0.1, 2.1, "px"),
      range("twinkle", 1, 12, 0.5, 4.5, "s"),
      range("zoneTop", 0, 100, 1, 9, "%"),
      range("zoneH", 5, 100, 1, 34, "%"),
      color("color", "#f4f1fa"),
    ],
  },
  // ---- Interface ----
  {
    id: "cards",
    group: "interface",
    cost: "faible",
    defaultOn: true,
    params: [
      range("radius", 8, 48, 1, 30, "px"),
      range("activeW", 180, 320, 2, 240, "px"),
      range("activeH", 240, 440, 2, 336, "px"),
      range("sideW", 120, 260, 2, 176, "px"),
      range("gap", 8, 60, 1, 22, "px"),
      range("dim", 0, 0.8, 0.01, 0.4),
      range("edge", 0, 1, 0.01, 0.6),
      range("pool", 0, 1, 0.01, 0.7),
    ],
    css: (v) =>
      v.on
        ? {
            "--da-card-radius": px(v, "radius"),
            "--da-card-dim": String(n(v, "dim")),
            "--da-card-edge": `rgba(255, 255, 255, ${n(v, "edge")})`,
            "--da-card-pool": String(n(v, "pool")),
          }
        : NONE,
  },
  {
    id: "cardHover",
    group: "interface",
    cost: "faible",
    defaultOn: true,
    params: [
      range("tilt", 0, 3, 0.1, 2.5, "°"),
      range("lift", 0, 10, 0.5, 4, "px"),
      range("duration", 100, 1200, 10, 450, "ms"),
      select("ease", Object.keys(EASES), "premium"),
      range("sheen", 0, 0.5, 0.01, 0.18),
    ],
    css: (v) => ({
      "--da-hover-tilt": String(v.on ? n(v, "tilt") : 0),
      "--da-hover-lift": v.on ? `${-n(v, "lift")}px` : "0px",
      "--da-hover-dur": `${n(v, "duration")}ms`,
      "--da-hover-ease": EASES[v.ease as string] ?? EASES.premium!,
      "--da-hover-sheen": String(v.on ? n(v, "sheen") : 0),
    }),
  },
  {
    id: "glass",
    group: "interface",
    cost: "moyen",
    defaultOn: true,
    params: [
      range("blur", 0, 40, 1, 18, "px"),
      range("saturate", 100, 220, 5, 140, "%"),
      range("tint", 0, 0.8, 0.01, 0.3),
      range("border", 0, 0.5, 0.01, 0.16),
      range("highlight", 0, 0.8, 0.01, 0.35),
      range("shadow", 0, 0.9, 0.01, 0.5),
      toggle("pill", true),
    ],
    css: (v) =>
      v.on
        ? {
            "--glass-filter": `blur(${n(v, "blur")}px) saturate(${n(v, "saturate")}%) brightness(1.06)`,
            "--glass-tint": `rgba(12, 8, 20, ${n(v, "tint")})`,
            "--glass-border": `rgba(255, 255, 255, ${n(v, "border")})`,
            "--glass-shadow": `inset 0 1px 0 rgba(255, 255, 255, ${n(v, "highlight")}), 0 20px 50px rgba(0, 0, 0, ${n(v, "shadow")})`,
            ...(v.pill ? { "--da-bar-radius": "999px" } : {}),
          }
        : NONE,
  },
  {
    id: "categoryTitle",
    group: "interface",
    cost: "faible",
    defaultOn: true,
    params: [
      range("size", 48, 140, 1, 96, "px"),
      range("weight", 300, 700, 10, 300),
      range("tracking", -0.06, 0.04, 0.005, -0.02, "em"),
      range("labelTracking", 0, 0.5, 0.01, 0.32, "em"),
      toggle("underline", true),
      range("underlineW", 40, 400, 5, 220, "px"),
      toggle("softLabel", true),
    ],
    css: (v) =>
      v.on
        ? {
            "--fs-title-xl": px(v, "size"),
            "--da-title-weight": String(n(v, "weight")),
            "--tracking-title": `${n(v, "tracking")}em`,
            "--da-label-tracking": `${n(v, "labelTracking")}em`,
            "--da-underline": v.underline ? px(v, "underlineW") : "0px",
            ...(v.softLabel ? { "--da-label-color": "var(--text-soft)" } : {}),
          }
        : NONE,
  },
  {
    id: "typography",
    group: "interface",
    cost: "faible",
    defaultOn: true,
    params: [select("pair", Object.keys(FONT_PAIRS), "kayro")],
    css: (v) => {
      const pair = FONT_PAIRS[v.on ? (v.pair as string) : "historique"] ?? FONT_PAIRS.historique!;
      return { "--font-title": pair.title, "--font-ui": pair.ui };
    },
  },
  // ---- Motion ----
  {
    id: "motion",
    group: "mouvement",
    cost: "faible",
    defaultOn: true,
    params: [range("card", 200, 1200, 10, 600, "ms"), select("ease", Object.keys(EASES), "douce")],
    css: (v) =>
      v.on
        ? { "--dur-card": `${n(v, "card")}ms`, "--ease": EASES[v.ease as string] ?? EASES.douce! }
        : NONE,
  },
  // ---- Elements of the step 3–12 sketch, kept to compare (off in the V4 direction) ----
  { id: "fog", group: "historique", cost: "moyen", defaultOn: false, fx: true, params: [] },
  { id: "beam", group: "historique", cost: "moyen", defaultOn: false, fx: true, params: [] },
  { id: "floor", group: "historique", cost: "faible", defaultOn: false, fx: true, params: [] },
  { id: "cardHalo", group: "historique", cost: "faible", defaultOn: false, fx: true, params: [] },
  {
    id: "dust",
    group: "historique",
    cost: "moyen",
    defaultOn: false,
    fx: true,
    params: [range("count", 0, 40, 1, 14)],
  },
  {
    id: "shine",
    group: "historique",
    cost: "faible",
    defaultOn: false,
    params: [],
  },
];

export const ELEMENTS: ReadonlyMap<string, DaElement> = new Map(CATALOGUE.map((e) => [e.id, e]));
