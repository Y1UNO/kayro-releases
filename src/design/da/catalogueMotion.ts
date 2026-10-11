// Round 3 elements of the art direction catalogue (step 12b): signature animations. Read by the
// screens through the store (no CSS variable, no FxLayer); the engine's part of an animation is
// cued by the screen itself (src/fx/gpu/cues.ts).
import { range, select, toggle, type DaElement } from "./daParams";

/** Curves of the round 3 sequences (subset of EASES, same names). */
export const SEQUENCE_EASES = ["premium", "vive", "douce", "ressort", "lineaire"] as const;

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
];
