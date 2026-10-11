// Round 3 elements of the art direction catalogue (step 12b): signature animations. Read by the
// screens through the store (no CSS variable, no FxLayer); the engine's part of an animation is
// cued by the screen itself (src/fx/gpu/cues.ts).
import { range, select, toggle, type DaElement } from "./daParams";

/** Curves of the round 3 sequences (subset of EASES, same names). */
export const SEQUENCE_EASES = [
  "premium",
  "vive",
  "douce",
  "ressort",
  "bascule",
  "lineaire",
] as const;
/** Springs of the deck unfolding (names of SPRINGS in src/design/glass/pillMotion.ts). */
export const LINK_SPRINGS = ["liaison", "leger", "net"] as const;

export const MOTION_ELEMENTS: readonly DaElement[] = [
  {
    // Opening V1-A "the letters come out of the logo" (reference/animations/R3-Ouverture-V1-A…):
    // the ring hatches (engine), the logo forms then slides left, the letters of the name come out
    // from behind it. Played once per start of the app, skippable. Timings of the base V1 are fixed
    // by the spec; only what V1-A changes is tunable, plus the overall speed and the hand-off.
    id: "opening",
    group: "mouvement",
    cost: "faible",
    defaultOn: true,
    params: [
      range("speed", 0.5, 1.6, 0.05, 1),
      range("slideMs", 300, 1200, 10, 650, "ms"),
      select("slideEase", SEQUENCE_EASES, "premium"),
      range("letterDelay", 30, 200, 5, 85, "ms"),
      range("letterMs", 300, 1400, 10, 800, "ms"),
      select("letterEase", SEQUENCE_EASES, "vive"),
      range("letterScale", 0.2, 1, 0.01, 0.45),
      range("letterBlur", 0, 14, 0.5, 6, "px"),
      range("ringRadius", 120, 320, 1, 200, "px"),
      // Instead of widening and fading, the ring grows into the home screen's ring.
      toggle("ringGrow", false),
      range("hold", 0, 2000, 50, 600, "ms"),
      range("handoff", 200, 1200, 10, 600, "ms"),
    ],
  },
  {
    // Category link A "the fan turns, then the deck unfolds" (reference/animations/R3-Categories-
    // Liaison-A…): at start-up, the 5 categories in a fan; a click turns the fan to bring the card
    // to the centre, it becomes a deck of its apps that unfolds into the carousel. Tabs gather the
    // deck and unfold it again; "All categories" plays it backwards. Values of the spec by default.
    id: "categoryLink",
    group: "mouvement",
    cost: "faible",
    defaultOn: true,
    params: [
      range("speed", 0.5, 1.6, 0.05, 1),
      range("angle", 3, 12, 0.5, 7, "°"),
      range("pivot", 600, 2400, 10, 1300, "px"),
      range("exitAngle", 5, 30, 0.5, 15, "°"),
      range("turnMs", 400, 1600, 10, 850, "ms"),
      select("turnEase", SEQUENCE_EASES, "bascule"),
      range("blur", 0, 12, 0.5, 6, "px"),
      range("unfoldMs", 300, 1400, 10, 700, "ms"),
      select("spring", LINK_SPRINGS, "liaison"),
      range("stagger", 0, 150, 5, 70, "ms"),
      range("regroup", 150, 900, 10, 380, "ms"),
      // Opacity of the theme gradient (A → B by rank) inside the glass of a category card.
      range("fill", 0, 1, 0.05, 0.85),
    ],
  },
  {
    // Hover of the category fan (round 3b): the card lifts, grows a little and tilts towards the
    // pointer; two crisp light threads run round its rim in opposite directions (theme A → B),
    // a few small sparks leave them. The five cards float slowly, each on its own rhythm.
    id: "categoryHover",
    group: "mouvement",
    cost: "faible",
    defaultOn: true,
    params: [
      range("hoverMs", 100, 800, 10, 240, "ms"),
      // Round 3b, "more reactive": the card pops in on a light spring, a burst at the hover-in
      // (the rim flashes, the threads whip half a turn, the sparks fly further).
      select("hoverSpring", LINK_SPRINGS, "leger"),
      range("burst", 0, 1, 0.05, 0.8),
      range("lift", 0, 24, 1, 12, "px"),
      range("tilt", 0, 3, 0.1, 3, "°"),
      range("grow", 0, 0.08, 0.005, 0.03),
      toggle("threads", true),
      range("threadIntensity", 0, 2, 0.05, 1.4),
      range("threadLength", 0.04, 0.4, 0.01, 0.14),
      range("threadSpeed", 0.05, 1.5, 0.01, 0.25, "tr/s"),
      range("threadWidth", 0.5, 3, 0.1, 1.8, "px"),
      // Halo at the head of each thread, pulsing gently (0 = none).
      range("threadGlow", 0, 1, 0.05, 0.7),
      range("sparks", 0, 12, 1, 12),
      range("sparkSize", 0.8, 5, 0.1, 2.4, "px"),
      range("floatRest", 0, 8, 0.5, 2.5, "px"),
      range("floatHover", 0, 12, 0.5, 6, "px"),
      range("floatPeriod", 3, 16, 0.5, 7, "s"),
      // Hovered card: slow pivot left / right (vertical axis), within the 3° tilt.
      range("sway", 0, 3, 0.1, 2, "°"),
      range("swayPeriod", 1.5, 8, 0.1, 3.6, "s"),
    ],
  },
];
