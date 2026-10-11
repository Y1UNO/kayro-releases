// Round 2b elements of the art direction catalogue (step 12b): what the glass engine adds to make
// the night feel lit and material. Engine only (nothing in CSS unless said), off by default so
// that the presets saved before round 2b keep their look.
import { n, range, type DaElement } from "./daParams";

export const AIR_ELEMENTS: readonly DaElement[] = [
  {
    // Embers and stars catch the engine's lights (moon halo, liquid ring, cursor): brighter, a
    // little larger and paler near them. Computed per particle in the sprite vertex shader.
    id: "particleLight",
    group: "particules",
    cost: "faible",
    defaultOn: false,
    fx: true,
    params: [
      range("intensity", 0, 1, 0.01, 0.6),
      // × the radius of each light (moon, ring glow, cursor light).
      range("reach", 0.3, 2, 0.05, 1),
      // How much a lit particle grows (its glow widens).
      range("halo", 0, 1, 0.01, 0.35),
    ],
  },
  {
    // Matter and depth where it helps: a fine grain in the glass rims, the rim's inner wall that
    // shades the inside and catches a thin line of light, and a slight parallax of the particles
    // after the cursor (stars far, bokeh mid, embers near). Each value at 0 = that part off. The
    // background grain stays `backdrop.grain` (CSS tile above the engine's canvas).
    id: "matter",
    group: "verre",
    cost: "faible",
    defaultOn: false,
    fx: true,
    params: [
      range("rimGrain", 0, 1, 0.01, 0.35),
      range("rimDepth", 0, 1, 0.01, 0.4),
      range("parallax", 0, 40, 1, 12, "px"),
    ],
  },
  {
    // Glossy veil (liquid reflection) on the selected card: a band of light glides across it,
    // then rests (src/fx/gpu/sheen.ts). Drawn by the engine inside the glass; above a DOM poster
    // (or without the engine) by a one-shot CSS animation (SheenVeil.tsx).
    id: "cardSheen",
    group: "verre",
    cost: "faible",
    defaultOn: false,
    fx: true,
    params: [
      range("intensity", 0, 1, 0.01, 0.3),
      // Glide time (the band then rests for the remaining 70 % of the cycle).
      range("duration", 600, 4000, 50, 1800, "ms"),
      range("width", 8, 60, 1, 28, "%"),
      range("angle", -45, 45, 1, 18, "°"),
    ],
    css: (v) => ({
      "--da-sheen-i": String(n(v, "intensity")),
      "--da-sheen-w": `${n(v, "width")}%`,
      "--da-sheen-angle": `${n(v, "angle")}deg`,
    }),
  },
  {
    // Posters as textures (src/fx/gpu/posterTextures.ts): the glass of a carousel card refracts its
    // real poster (bent by the rim's lens, colour fringes) and mirrors it faintly on the rim. Same
    // picture as the page's; one texture per poster in use, released when no card shows it.
    // Automatic fallback to the DOM picture (load refused, frame budget: first rung).
    id: "posterGlass",
    group: "verre",
    cost: "moyen",
    defaultOn: false,
    fx: true,
    params: [
      range("refraction", 0, 2, 0.05, 1),
      range("reflection", 0, 1, 0.01, 0.35),
      range("maxTextures", 1, 6, 1, 6),
    ],
  },
];
