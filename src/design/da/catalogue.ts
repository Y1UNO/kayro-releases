/**
 * Catalogue of the visual elements of the art direction (step 12b, frozen: docs/DESIGN.md). Every
 * tunable look of the app is declared here: its parameters (bounds, default), its estimated cost,
 * whether it is on. The defaults ARE the shipped art direction (`active.json` holds no values);
 * the user's settings override some of them (userDa.ts). Adding or removing an element = this
 * file + one isolated module (an FxLayer or a few CSS variables).
 *
 * Two kinds of consumers:
 *  - `css`: the element writes CSS variables on <html> (screens: cards, glass, titles…);
 *  - `fx`: the atmosphere layers read the values through `FxLayer.setParams`.
 */

import { EASES } from "../motion/eases";
import { color, n, NONE, px, range, select, toggle, userSelect, type DaElement } from "./daParams";
import { CARD_HOVER_STYLES } from "../motion/tokens5";
import { AIR_ELEMENTS } from "./catalogueAir";
import { GLASS_ELEMENTS } from "./catalogueGlass";
import { MOTION_ELEMENTS } from "./catalogueMotion";

export type {
  ColorParam,
  DaCost,
  DaElement,
  DaGroup,
  DaParam,
  DaValue,
  DaValues,
  ElementValues,
  RangeParam,
  SelectParam,
  ToggleParam,
} from "./daParams";

/** Curves offered for UI motion (`ease` selects): src/design/motion/eases.ts. */
export { EASES };

/** Font pairs (`typography.pair`): titles / interface. Bundled (no CDN), same as tokens.css. */
export const FONT_PAIRS: Readonly<Record<string, { title: string; ui: string }>> = {
  kayro: {
    title: '"Cormorant Garamond Variable", Georgia, serif',
    ui: '"Manrope Variable", system-ui, sans-serif',
  },
};

/** A rounded rectangle filling its box (radius in px), as a CSS mask image. */
export function cardHole(radius: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg'><rect width='100%' height='100%' rx='${radius}'/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/%/g, "%25").replace(/</g, "%3C").replace(/>/g, "%3E")}")`;
}

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
      // Round 2b ("plus aéré"): lifts the whole background towards a light mix of the theme.
      range("lift", 0, 0.3, 0.01, 0),
    ],
    css: (v) => ({
      "--da-bg":
        v.on && v.shape === "radial"
          ? "radial-gradient(90% 75% at 50% 0%, var(--bg-top) 0%, var(--bg-mid) 50%, var(--bg-bottom) 100%)"
          : "linear-gradient(180deg, var(--bg-top) 0%, var(--bg-mid) 55%, var(--bg-bottom) 100%)",
      "--da-vignette": String(v.on ? n(v, "vignette") : 0.62),
      "--da-grain": String(v.on ? n(v, "grain") : 0.09),
      "--da-bg-lift": String(v.on ? n(v, "lift") : 0),
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
      // 0 = mock-up profile (falls to 35 % at 55 % of the radius); 1 = wide, airy glow.
      range("spread", 0, 1, 0.01, 0),
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
  // ---- Liquid glass (WebGL2 engine, step 12b round 2) ----
  ...GLASS_ELEMENTS,
  ...AIR_ELEMENTS,
  ...MOTION_ELEMENTS,
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
            // Card-shaped hole in the light pool when the engine draws the poster (round 2b).
            "--da-card-hole": cardHole(n(v, "radius")),
          }
        : NONE,
  },
  {
    id: "cardHover",
    group: "interface",
    cost: "faible",
    defaultOn: true,
    // Round 4a: duration and curve come from the motion token table (`motion`); `lift` is the grid
    // cards' (level 1), the carousel cards lift by the table's `cardLift` (level 3).
    // Level 3 of the carousel cards: after `delay` of the pointer on the card, one glossy veil
    // (`veilMs`) then the two light threads of the fan (its `categoryHover` look), `sparks` at most;
    // a flash at the launch (`launchFlash` × the "long" token). The reflection that follows the
    // pointer (`sheen`) is a 3rd effect: off on carousel cards at level 3 (rule 1).
    params: [
      range("tilt", 0, 3, 0.1, 2.5, "°"),
      range("lift", 0, 10, 0.5, 4, "px"),
      range("sheen", 0, 0.5, 0.01, 0.18),
      range("delay", 0, 400, 10, 120, "ms"),
      range("veilMs", 300, 1600, 10, 800, "ms"),
      range("sparks", 0, 4, 1, 4),
      range("launchFlash", 0.5, 3, 0.1, 1.6),
      // Round 5, « Survol des cartes » of the settings: full (veil + threads) / simple (lift) / none.
      userSelect("style", CARD_HOVER_STYLES, "full"),
    ],
    css: (v) => ({
      "--da-hover-tilt": String(v.on ? n(v, "tilt") : 0),
      "--da-hover-lift": v.on ? `${-n(v, "lift")}px` : "0px",
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
      toggle("underline", true),
      range("underlineW", 40, 400, 5, 220, "px"),
      // Round 3b: a brighter rule (thickness, glow) and a light that glides along it now and then.
      range("underlineH", 0.5, 3, 0.1, 1.5, "px"),
      range("underlineGlow", 0, 1, 0.05, 0.6),
      range("underlineShine", 0, 20, 0.5, 7, "s"),
    ],
    css: (v) =>
      v.on
        ? {
            "--fs-title-xl": px(v, "size"),
            "--da-title-weight": String(n(v, "weight")),
            "--tracking-title": `${n(v, "tracking")}em`,
            "--da-underline": v.underline ? px(v, "underlineW") : "0px",
            "--da-underline-h": px(v, "underlineH"),
            "--da-underline-glow": String(n(v, "underlineGlow")),
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
      const pair = FONT_PAIRS[v.pair as string] ?? FONT_PAIRS.kayro!;
      return { "--font-title": pair.title, "--font-ui": pair.ui };
    },
  },
  // ---- Motion: the token table and the signature animations (catalogueMotion.ts) ----
];

export const ELEMENTS: ReadonlyMap<string, DaElement> = new Map(CATALOGUE.map((e) => [e.id, e]));
