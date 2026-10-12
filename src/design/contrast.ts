import { contrastRatio, flatten, luminance, mustParse, scale } from "../lib/color";
import type { Rgba } from "../lib/color";
import type { Theme } from "./theme";

/*
 * Model of what sits behind text, mirroring tokens.css (contrast.drift.test.ts fails if the two diverge).
 *
 * Pessimistic choices:
 *  - page: the lightest spot text can sit on = the core of one fog layer, with another fading in at
 *    half strength (see lightestPage);
 *  - glass: backdrop x1.06 (brightness of the glass filter), smoke tint, then white at .12 (the
 *    gradient value under most of the surface). The 135° gradient reaches .20 only in the top-left
 *    corner, where the highlight is also drawn: short labels placed within ~30 px of that corner
 *    are not covered by this test (limit reported in ROADMAP).
 *  - not modelled: saturate(190%) (changes chroma more than luminance), the vignette (only darkens).
 */
export const MODEL = {
  text: "#f6efe8",
  text2: "rgba(246,239,232,.88)",
  text3: "rgba(246,239,232,.84)",
  textActive: "#ffffff",
  textOnAccent: "#1a1020",
  glassTint: "rgba(12,8,20,.3)",
  glassBrightness: 1.06,
  glassWhiteUnderText: 0.12,
  glassEco: "rgba(30,22,40,.82)",
  fillSoft: 0.1,
  fillTabActive: 0.16,
  fillActive: 0.16,
  field: 0.22,
  navActive: 0.22,
  tooltip: "rgba(20,14,28,.94)",
  /** Dialog panel (round 5, `--panel-bg`): the theme's middle background at this opacity. */
  panelMix: 0.92,
  /**
   * Face of a category card (CategoryFan.module.css), at the top-left of its name (round 5): the
   * A → B colour darkened by the face's gradient there (× 0.37), the fill opacity, then the foot
   * shade (black at .29 at that height).
   */
  faceGradAtName: 0.37,
  faceFill: 0.85,
  faceShadeAtName: 0.29,
} as const;

const WHITE = (a: number): Rgba => ({ r: 255, g: 255, b: 255, a });
const BLACK = (a: number): Rgba => ({ r: 0, g: 0, b: 0, a });

export interface Surfaces {
  /** Page background where fog is lightest. */
  page: Rgba;
  /** Page background at the top centre, where only the faint fog C sits (category label). */
  pageTop: Rgba;
  glass: Rgba;
  glassEco: Rgba;
  /** Inset field (search, segmented group, active nav item) on glass. */
  field: Rgba;
  chipSelected: Rgba;
  segmentSelected: Rgba;
  softButton: Rgba;
  tooltip: Rgba;
  accent: Rgba;
  /** Dialog panel over the page (round 5), pessimistic white .12 like the glass. */
  panel: Rgba;
  /** Lightest face of the category fan under a card's name (round 5). */
  fanFace: Rgba;
  /** Bottom of a theme card in the settings (its name), with the same foot shade. */
  themeCardFoot: Rgba;
}

/**
 * Lightest background a text can realistically sit on: the core of one fog layer, optionally with
 * another one fading in at half strength (the ovals overlap only at their soft edges).
 */
function lightestPage(mid: Rgba, fog: Rgba[]): Rgba {
  const candidates: Rgba[] = [];
  for (const [i, core] of fog.entries()) {
    candidates.push(flatten([mid, core]));
    for (const [j, edge] of fog.entries()) {
      if (i !== j) candidates.push(flatten([mid, core, { ...edge, a: edge.a / 2 }]));
    }
  }
  return candidates.reduce((best, c) => (luminance(c) > luminance(best) ? c : best));
}

export function surfacesOf(theme: Theme): Surfaces {
  const mid = mustParse(theme.bg[1]);
  const fog = theme.fog.map(mustParse);
  const page = lightestPage(mid, fog);
  const glass = flatten([
    scale(page, MODEL.glassBrightness),
    mustParse(MODEL.glassTint),
    WHITE(MODEL.glassWhiteUnderText),
  ]);
  const field = flatten([glass, BLACK(MODEL.field)]);
  return {
    page,
    pageTop: flatten([mid, fog[2] as Rgba]),
    glass,
    glassEco: flatten([page, mustParse(MODEL.glassEco)]),
    field,
    chipSelected: flatten([glass, WHITE(MODEL.fillTabActive)]),
    segmentSelected: flatten([field, WHITE(MODEL.fillActive)]),
    softButton: flatten([glass, WHITE(MODEL.fillSoft)]),
    tooltip: flatten([page, mustParse(MODEL.tooltip)]),
    accent: mustParse(theme.accent),
    panel: flatten([page, { ...mid, a: MODEL.panelMix }, WHITE(MODEL.glassWhiteUnderText)]),
    fanFace: fanFaceOf(theme, glass),
    themeCardFoot: flatten([mustParse(theme.bg[2]), BLACK(MODEL.faceShadeAtName)]),
  };
}

/** The lighter of the gradient's two ends, darkened as under a fan card's name, over the glass. */
function fanFaceOf(theme: Theme, glass: Rgba): Rgba {
  const ends = (theme.gradient ?? [theme.accent, theme.accent]).map(mustParse);
  const light = ends.reduce((a, b) => (luminance(b) > luminance(a) ? b : a));
  const k = MODEL.faceGradAtName;
  const face: Rgba = { r: light.r * k, g: light.g * k, b: light.b * k, a: MODEL.faceFill };
  return flatten([glass, face, BLACK(MODEL.faceShadeAtName)]);
}

export interface ContrastPair {
  name: string;
  fg: Rgba;
  bg: Rgba;
}

/** `--accent-light`: 60 % accent + 40 % white. */
function accentLight(accent: Rgba): Rgba {
  const mix = (v: number) => v * 0.6 + 255 * 0.4;
  return { r: mix(accent.r), g: mix(accent.g), b: mix(accent.b), a: 1 };
}

/** Every text / surface couple used by the design system, for one theme. */
export function contrastPairs(theme: Theme): ContrastPair[] {
  const s = surfacesOf(theme);
  const text = mustParse(MODEL.text);
  const text2 = mustParse(MODEL.text2);
  const text3 = mustParse(MODEL.text3);
  const active = mustParse(MODEL.textActive);
  return [
    { name: "text on page", fg: text, bg: s.page },
    { name: "text-2 on page", fg: text2, bg: s.page },
    { name: "text-3 on page", fg: text3, bg: s.page },
    { name: "accent on page top (category label)", fg: s.accent, bg: s.pageTop },
    { name: "text on glass", fg: text, bg: s.glass },
    { name: "text-2 on glass", fg: text2, bg: s.glass },
    { name: "text-3 on glass", fg: text3, bg: s.glass },
    { name: "text on glass (Eco)", fg: text, bg: s.glassEco },
    { name: "text-2 on glass (Eco)", fg: text2, bg: s.glassEco },
    { name: "text-3 on glass (Eco)", fg: text3, bg: s.glassEco },
    { name: "text-2 on field", fg: text2, bg: s.field },
    { name: "text on soft button", fg: text, bg: s.softButton },
    { name: "text-2 on unselected chip", fg: text2, bg: s.glass },
    { name: "active text on selected chip", fg: active, bg: s.chipSelected },
    { name: "active text on selected segment", fg: active, bg: s.segmentSelected },
    { name: "accent-light on active nav item", fg: accentLight(s.accent), bg: s.field },
    { name: "text on accent (primary button)", fg: mustParse(MODEL.textOnAccent), bg: s.accent },
    { name: "text on tooltip", fg: text, bg: s.tooltip },
    { name: "text-2 on dialog panel", fg: text2, bg: s.panel },
    { name: "text-3 on dialog panel", fg: text3, bg: s.panel },
    { name: "name on a category card face", fg: active, bg: s.fanFace },
    { name: "text-2 on a category card face", fg: text2, bg: s.fanFace },
    { name: "name on a theme card", fg: active, bg: s.themeCardFoot },
  ];
}

export function worstContrast(theme: Theme): { name: string; ratio: number } {
  return contrastPairs(theme)
    .map((p) => ({ name: p.name, ratio: contrastRatio(p.fg, p.bg) }))
    .reduce((w, c) => (c.ratio < w.ratio ? c : w));
}
