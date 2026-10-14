/**
 * Springs written as CSS `linear()` curves (art direction round 4b,
 * reference/animations/R4b-notes-4b/r4b-notes/R4b-3c-Widget.txt): real damped springs (one
 * overshoot, then a slow settle), sampled at 41 evenly spaced points. Data only: the motion token
 * table (tokens.ts) is the one that exposes them. Sister table of SPRINGS
 * (src/design/glass/pillMotion.ts, overshoots for `springAt`), same 8 % ceiling (tested).
 *
 * The widget's glass unrolls on two of them at once: the vertical one (top → bottom, elastic)
 * and the horizontal one (sides, lighter).
 */

export const UNROLL_SPRINGS = ["douce", "normale", "forte"] as const;
export type UnrollSpring = (typeof UNROLL_SPRINGS)[number];

interface LinearSpring {
  /** Overshoot announced by the spec (fraction of the travel). */
  overshoot: number;
  points: readonly number[];
}

const DOUCE_35: LinearSpring = {
  overshoot: 0.035,
  // prettier-ignore
  points: [0, 0.0167, 0.0608, 0.1242, 0.2001, 0.283, 0.3686, 0.4536, 0.5352, 0.6118, 0.6821, 0.7454, 0.8014, 0.8501, 0.8917, 0.9266, 0.9553, 0.9785, 0.9966, 1.0105, 1.0206, 1.0276, 1.032, 1.0344, 1.035, 1.0344, 1.0328, 1.0306, 1.0279, 1.025, 1.022, 1.019, 1.0162, 1.0135, 1.011, 1.0088, 1.0069, 1.0052, 1.0037, 1.0025, 1],
};

/** Vertical spring (the glass unrolling downwards), played over `unroll.vMs`. */
export const SPRING_V: Readonly<Record<UnrollSpring, LinearSpring>> = {
  douce: DOUCE_35,
  normale: {
    overshoot: 0.05,
    // prettier-ignore
    points: [0, 0.0272, 0.0965, 0.1923, 0.302, 0.4159, 0.5269, 0.6302, 0.7227, 0.8027, 0.8698, 0.9241, 0.9667, 0.9987, 1.0215, 1.0366, 1.0455, 1.0495, 1.0497, 1.0474, 1.0433, 1.0381, 1.0325, 1.0268, 1.0214, 1.0165, 1.0121, 1.0084, 1.0053, 1.0028, 1.0009, 0.9995, 0.9986, 0.9979, 0.9976, 0.9975, 0.9976, 0.9977, 0.9979, 0.9982, 1],
  },
  forte: {
    overshoot: 0.07,
    // prettier-ignore
    points: [0, 0.0283, 0.101, 0.2018, 0.3175, 0.4377, 0.5548, 0.6634, 0.7599, 0.8425, 0.9107, 0.9647, 1.0056, 1.0349, 1.0542, 1.0652, 1.0697, 1.0692, 1.0651, 1.0586, 1.0508, 1.0424, 1.0341, 1.0263, 1.0192, 1.013, 1.0079, 1.0037, 1.0006, 0.9982, 0.9966, 0.9957, 0.9952, 0.9951, 0.9953, 0.9957, 0.9962, 0.9968, 0.9974, 0.998, 1],
  },
};

/** Horizontal spring (the sides, lighter), played over `unroll.hMs`. */
export const SPRING_H: Readonly<Record<UnrollSpring, LinearSpring>> = {
  douce: {
    overshoot: 0.015,
    // prettier-ignore
    points: [0, 0.0189, 0.0677, 0.1362, 0.2165, 0.3024, 0.3892, 0.4736, 0.5531, 0.6264, 0.6926, 0.7512, 0.8023, 0.8461, 0.8832, 0.9141, 0.9394, 0.9597, 0.9758, 0.9883, 0.9977, 1.0045, 1.0093, 1.0124, 1.0141, 1.0149, 1.0149, 1.0144, 1.0135, 1.0124, 1.0111, 1.0098, 1.0085, 1.0073, 1.0062, 1.0051, 1.0042, 1.0034, 1.0026, 1.002, 1],
  },
  normale: {
    overshoot: 0.025,
    // prettier-ignore
    points: [0, 0.0178, 0.0642, 0.1303, 0.2086, 0.2933, 0.3798, 0.4648, 0.5458, 0.6211, 0.6895, 0.7506, 0.8043, 0.8505, 0.8898, 0.9226, 0.9494, 0.971, 0.9879, 1.0008, 1.0103, 1.017, 1.0214, 1.0239, 1.0249, 1.0248, 1.0239, 1.0225, 1.0206, 1.0185, 1.0164, 1.0142, 1.0122, 1.0102, 1.0084, 1.0068, 1.0054, 1.0042, 1.0031, 1.0023, 1],
  },
  forte: DOUCE_35,
};

/** The soft vertical spring (3.5 %) that carries each row of the panel down with the glass. */
export const ROW_SPRING: LinearSpring = DOUCE_35;

/** CSS of a spring: `linear(0, 0.0272, …, 1)`. */
export function linearCss(s: LinearSpring): string {
  return `linear(${s.points.join(", ")})`;
}
