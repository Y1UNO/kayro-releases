// Round 2b element of the art direction catalogue (step 12b) kept at the freeze: the posters in
// the glass, off until local art comes (step 14). The other round 2b elements (lit particles,
// matter and parallax, glossy veil) were never retained: they live in git at tag `perf-13-fix`.
import { range, type DaElement } from "./daParams";

export const AIR_ELEMENTS: readonly DaElement[] = [
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
