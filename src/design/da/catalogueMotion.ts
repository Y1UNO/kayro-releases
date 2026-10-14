// Round 3 elements of the art direction catalogue (step 12b): signature animations. Read by the
// screens through the store (no CSS variable, no FxLayer); the engine's part of an animation is
// cued by the screen itself (src/fx/gpu/cues.ts).
import { EASES } from "../motion/eases";
import { UNROLL_SPRINGS } from "../motion/springCurves";
import { MOTION_DEFAULTS as M, motionCss, motionTokens, SPEEDS } from "../motion/tokens";
import { OPENING_C, OPENING_PULSES, WIDGET_MOTIONS } from "../motion/tokens4b";
import { NONE, range, select, toggle, userSelect, type DaElement } from "./daParams";
import { FLOAT_NAMES, MOTION_STYLES } from "../motion/tokens5";

const CURVES = Object.keys(EASES);

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
    // Round 4a: the motion token table of the whole interface ("Vivant intelligent",
    // src/design/motion/tokens.ts). Off = the defaults of the table (motion.css).
    id: "motion",
    group: "mouvement",
    cost: "faible",
    defaultOn: true,
    params: [
      select("speed", SPEEDS, "1"),
      toggle("level1", true),
      toggle("level2", true),
      toggle("level3", true),
      range("micro", 40, 400, 5, M.micro, "ms"),
      range("court", 80, 600, 5, M.court, "ms"),
      range("moyen", 120, 900, 5, M.moyen, "ms"),
      range("long", 200, 1400, 10, M.long, "ms"),
      range("outShare", 0.3, 1, 0.05, M.outShare),
      select("easeIn", CURVES, M.easeIn),
      select("easeOut", CURVES, M.easeOut),
      select("easeMove", CURVES, M.easeMove),
      select("easeBounce", CURVES, M.easeBounce),
      range("cascade", 0, 150, 5, M.cascade, "ms"),
      range("rise", 0, 40, 1, M.rise, "px"),
      range("hoverRise", 0, 4, 0.5, M.hoverRise, "px"),
      range("press", 0.85, 1, 0.01, M.press),
      range("panelScale", 0.85, 1, 0.01, M.panelScale),
      range("focusGap", 0, 6, 0.5, M.focusGap, "px"),
      range("focusA", 0, 10, 0.5, M.focusA, "px"),
      range("focusB", 0, 14, 0.5, M.focusB, "px"),
      range("focusBAlpha", 0, 1, 0.05, M.focusBAlpha),
      range("focusHalo", 0, 60, 1, M.focusHalo, "px"),
      range("focusHaloAlpha", 0, 1, 0.05, M.focusHaloAlpha),
      range("cardLift", 0, 24, 1, M.cardLift, "px"),
      range("cardGrow", 1, 1.08, 0.005, M.cardGrow),
      // Round 4b: widget panel, empty category.
      // Round 5: chosen in Réglages › Visuel (userDa.ts), not tuned here.
      userSelect("widgetMotion", WIDGET_MOTIONS, M.widgetMotion),
      userSelect("widgetSpring", UNROLL_SPRINGS, M.widgetSpring),
      toggle("widgetHalo", true),
      toggle("widgetSheen", true),
      range("emptyFloat", 0, 8, 0.5, M.emptyFloat, "px"),
      // Round 5, « Mouvement » of the settings: complete / lively (validated) / crisp.
      userSelect("style", MOTION_STYLES, "lively"),
    ],
    css: (v) => (v.on ? motionCss(motionTokens(v)) : NONE),
  },
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
      range("hold", 0, 2000, 50, 600, "ms"),
      range("handoff", 200, 1200, 10, 600, "ms"),
      // Round 4b (validated 2026-10-12): variant C's pulse in the opaque opening (the page is
      // seen only in the ring, darkened around; the ringOut sends a wave and opens it in a
      // circle). "v1a" = the opening without it (« Classique »).
      // Round 5: « Ouverture au lancement » of the settings picks it (userDa.ts).
      userSelect("pulse", OPENING_PULSES, "c"),
      range("veil", 0, 0.8, 0.02, OPENING_C.veil),
      range("wave", 0, 1, 0.05, OPENING_C.wave),
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
      // Round 5 (proposal 7): seen on every face (white core in Rim.module.css).
      range("threadIntensity", 0, 2, 0.05, 1.8),
      range("threadLength", 0.04, 0.4, 0.01, 0.2),
      range("threadSpeed", 0.05, 1.5, 0.01, 0.25, "tr/s"),
      range("threadWidth", 0.5, 3, 0.1, 2.2, "px"),
      // Halo at the head of each thread, pulsing gently (0 = none).
      range("threadGlow", 0, 1, 0.05, 0.9),
      range("sparks", 0, 12, 1, 12),
      range("sparkSize", 0.8, 5, 0.1, 2.4, "px"),
      // Round 5: « Flottaison des cartes » of the settings (levels in tokens5.ts, fan and carousel).
      userSelect("float", FLOAT_NAMES, "visible"),
      // Review B3: the hovered card floats × this (was a fixed px value, dead from « Visible » on).
      range("floatHoverGain", 1, 1.6, 0.05, 1.15),
      // Hovered card: slow pivot left / right (vertical axis), within the 3° tilt.
      range("sway", 0, 3, 0.1, 2, "°"),
      range("swayPeriod", 1.5, 8, 0.1, 3.6, "s"),
    ],
  },
];
