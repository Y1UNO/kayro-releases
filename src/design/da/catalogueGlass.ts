// Liquid glass elements of the art direction catalogue (step 12b, round 2): the WebGL2 engine
// (src/fx/gpu) and what it alone can draw (liquid ring, light bands, bokeh, cursor light). Each
// glass kind has factors (×) of the global values of `glassEngine`, so one slider tunes everything
// and the kinds stay comparable. `glassEngine` off = the CSS look of round 1, to compare.
// Round 2a (user's feedback): by default only the cards and the selection pills are glass; bars,
// dock and round buttons keep their CSS look (their kinds stay available, off).
import { SPRINGS } from "../glass/pillMotion";
import { n, range, select, type DaElement, type DaParam, type ElementValues } from "./daParams";

/** Glass kinds drawn by the engine, by catalogue element (the DOM registry uses the same names). */
export const GLASS_KIND_ELEMENT = {
  card: "glassCards",
  bar: "glassBars",
  dock: "glassDock",
  button: "glassButtons",
  pill: "glassPills",
} as const;

interface KindDefaults {
  on?: boolean;
  refraction?: number;
  thickness?: number;
  dispersion?: number;
  blur?: number;
  bevel?: number;
  spec?: number;
  shadow?: number;
  tint: number;
}

const factor = (key: string, def = 1) => range(key, 0, 2, 0.05, def);

function glassKind(
  id: string,
  d: KindDefaults,
  extra: readonly DaParam[] = [],
  css?: (v: ElementValues) => Record<string, string>,
): DaElement {
  return {
    id,
    group: "verre",
    cost: "moyen",
    defaultOn: d.on ?? true,
    fx: true,
    params: [
      factor("refraction", d.refraction),
      factor("thickness", d.thickness),
      factor("dispersion", d.dispersion),
      factor("blur", d.blur),
      factor("bevel", d.bevel),
      factor("spec", d.spec),
      factor("shadow", d.shadow),
      range("tint", 0, 1, 0.01, d.tint),
      ...extra,
    ],
    css,
  };
}

export const GLASS_ELEMENTS: readonly DaElement[] = [
  {
    id: "glassEngine",
    group: "verre",
    cost: "élevé",
    defaultOn: true,
    fx: true,
    params: [
      range("refraction", 0, 1, 0.01, 0.6),
      range("thickness", 4, 60, 1, 14, "px"),
      range("dispersion", 0, 1, 0.01, 0.55),
      range("blur", 0, 1, 0.01, 0.22),
      range("bevel", 0, 1, 0.01, 0.55),
      range("spec", 0, 1, 0.01, 0.8),
      // Width of the speculars and of the cursor's light on the rim: 1 = thin and crisp.
      range("sharpness", 0, 1, 0.01, 0.75),
      range("shadow", 0, 1, 0.01, 0.5),
      range("fusion", 0, 40, 1, 16, "px"),
      select("resolution", ["auto", "1", "0.75", "0.5"], "auto"),
    ],
  },
  {
    // Round 2a look, kept to compare: the ring as a thick glass tube (geometry from `crystalRing`).
    id: "glassRing",
    group: "verre",
    cost: "moyen",
    defaultOn: false,
    fx: true,
    params: [
      range("band", 6, 60, 1, 26, "px"),
      factor("refraction", 1.2),
      factor("dispersion", 1.2),
      factor("blur", 0.3),
      factor("bevel", 1),
      factor("spec", 1),
    ],
  },
  glassKind(
    "glassCards",
    { thickness: 0.75, tint: 0.14 },
    [
      range("posterOpacity", 0.2, 1, 0.01, 1),
      range("gridPosterOpacity", 0.2, 1, 0.01, 1),
      range("posterInset", 0, 24, 1, 3, "px"),
    ],
    (v) => ({
      "--da-poster-opacity": String(n(v, "posterOpacity")),
      "--da-grid-poster-opacity": String(n(v, "gridPosterOpacity")),
      "--da-poster-inset": `${n(v, "posterInset")}px`,
    }),
  ),
  // Selection pill of the category tabs and of the display mode selector: a small piece of glass
  // that slides from one choice to the other, stretching a little on the way. Round 2b: `spring`
  // = named preset "net" (no bounce) or "leger" (passes its target by 5 %, settles back).
  glassKind(
    "glassPills",
    { thickness: 0.7, blur: 0.6, tint: 0.14 },
    [
      range("duration", 150, 900, 10, 420, "ms"),
      range("stretch", 0, 1, 0.01, 0.35),
      select("spring", Object.keys(SPRINGS), "net"),
    ],
    (v) => ({
      "--da-pill-dur": `${n(v, "duration")}ms`,
      "--da-pill-stretch": String(n(v, "stretch")),
      "--da-pill-bounce": String(SPRINGS[String(v.spring)] ?? 0),
    }),
  ),
  glassKind("glassBars", { on: false, thickness: 0.8, tint: 0.34 }),
  glassKind("glassDock", { on: false, thickness: 0.8, tint: 0.3 }),
  glassKind("glassButtons", { on: false, thickness: 0.6, blur: 0.5, tint: 0.12 }),
  // ---- What the engine adds behind the glass (engine only: nothing in CSS) ----
  {
    // Crystal ring of round 2a, liquid: a thin soft line of light (geometry from `crystalRing`),
    // turning slowly and irregularly; now and then a bit of it bulges out like a drop and melts back.
    id: "liquidRing",
    group: "fond",
    cost: "faible",
    defaultOn: true,
    fx: true,
    params: [
      range("thickness", 0.5, 6, 0.1, 1.2, "px"),
      range("blur", 0, 30, 0.5, 9, "px"),
      range("intensity", 0, 1, 0.01, 0.32),
      range("speed", 0, 3, 0.05, 0.5, "tr/min"),
      range("dripRate", 0, 6, 0.1, 1.2, "/min"),
      range("dripAmount", 0, 60, 1, 16, "px"),
    ],
  },
  {
    id: "lightBands",
    group: "fond",
    cost: "faible",
    defaultOn: true,
    fx: true,
    params: [
      range("count", 0, 4, 1, 3),
      range("intensity", 0, 0.4, 0.01, 0.1),
      range("width", 10, 240, 5, 70, "px"),
      range("angle", -80, 80, 1, -24, "°"),
      range("period", 20, 180, 1, 70, "s"),
    ],
  },
  {
    id: "bokeh",
    group: "fond",
    cost: "faible",
    defaultOn: true,
    fx: true,
    params: [
      range("count", 0, 24, 1, 12),
      range("size", 10, 140, 1, 56, "px"),
      range("intensity", 0, 0.5, 0.01, 0.14),
      range("zoneTop", 0, 100, 1, 18, "%"),
      range("zoneH", 10, 100, 1, 60, "%"),
    ],
  },
  {
    id: "cursorLight",
    group: "fond",
    cost: "faible",
    defaultOn: true,
    fx: true,
    params: [
      range("intensity", 0, 1, 0.01, 0.3),
      range("radius", 80, 700, 10, 300, "px"),
      range("spec", 0, 1, 0.01, 0.6),
    ],
  },
];
