/**
 * The widget's panel opens by unrolling its glass (art direction round 4b,
 * reference/animations/R4b-notes-4b/r4b-notes/R4b-3c-Widget.txt): pure description of every
 * Web Animation of an opening or a folding, from the motion token table. Played by `useUnroll`
 * with `element.animate()` (composited, no per-frame script; WebView2 reads CSS `linear()`).
 *
 * Opening ("deroule"): the shell unrolls downwards on the vertical spring and widens on the
 * horizontal one, the rows come down one by one behind its edge (3.5 % spring), then the pills and
 * icons pop in; a halo lights under the panel, a light band sweeps the glass once.
 * Folding: the content fades, then the shell rolls back up and narrows, fast, without bounce.
 */
import { EASES } from "../../design/motion/eases";
import type { MotionTokens } from "../../design/motion/tokens";

/** What a step animates: the shell's two boxes, the content, the halo, the band, the bar… */
export type Target =
  | "hull"
  | "inner"
  | "content"
  | "halo"
  | "sheen"
  | "bar"
  | { row: number }
  | { chip: [number, number] };

export interface Step {
  target: Target;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions & { delay: number; duration: number };
}

/** Current look of the animated boxes, when a phase starts from where the last one stopped. */
export interface From {
  hull?: { transform: string; opacity: string };
  inner?: string;
  content?: string;
  halo?: string;
}

export interface UnrollShape {
  /** Rows of the content, top to bottom (search, scenes, running, recents). */
  rows: number;
  /** Pills / icons in each row. */
  chips: readonly number[];
  eco: boolean;
}

const IN = "backwards" as const;
const OUT = "forwards" as const;

function startPose(w: MotionTokens["widget"]) {
  return {
    hull: `scaleX(${w.fromScaleX})`,
    inner: `translateY(${w.fromY}px) scaleY(${w.fromScaleY})`,
  };
}

/**
 * The opening. `from` (a click while it folds): the shell goes back from where it is, the content
 * fades back in, without replaying the rows.
 */
export function unrollSteps(t: MotionTokens, shape: UnrollShape, from?: From): Step[] {
  const w = t.widget;
  const steps: Step[] = [];
  const at = (delay: number, duration: number, easing: string, fill: FillMode = IN) => ({
    delay,
    duration,
    easing,
    fill,
  });

  if (w.motion === "sobre") {
    const s = w.sober;
    const box = [
      { transform: `scale(${s.from})`, opacity: 0 },
      { transform: "scale(1)", opacity: 1 },
    ];
    steps.push({ target: "hull", keyframes: box, options: at(0, s.ms, t.ease.in) });
    steps.push({ target: "content", keyframes: box, options: at(0, s.ms, t.ease.in) });
    if (!from) {
      for (let i = 0; i < shape.rows; i++) {
        steps.push({
          target: { row: i },
          keyframes: [{ opacity: 0 }, { opacity: 1 }],
          options: at(i * s.rowStep, s.ms, t.ease.in),
        });
      }
    }
    return steps;
  }

  const pose = startPose(w);
  steps.push({
    target: "hull",
    keyframes: [{ transform: from?.hull?.transform ?? pose.hull }, { transform: "scaleX(1)" }],
    options: at(0, w.hMs, w.springH),
  });
  steps.push({
    target: "hull",
    keyframes: [{ opacity: from?.hull?.opacity ?? 0 }, { opacity: 1 }],
    options: at(0, w.hullFade, "linear"),
  });
  steps.push({
    target: "inner",
    keyframes: [
      { transform: from?.inner ?? pose.inner },
      { transform: "translateY(0px) scaleY(1)" },
    ],
    options: at(0, w.vMs, w.springV),
  });
  if (w.halo && !shape.eco) {
    steps.push({
      target: "halo",
      keyframes: [{ opacity: from?.halo ?? 0 }, { opacity: 1 }],
      options: at(from ? 0 : w.haloAt, w.haloMs, t.ease.in),
    });
  }

  if (from) {
    steps.push({
      target: "content",
      keyframes: [{ opacity: from.content ?? 0 }, { opacity: 1 }],
      options: at(0, w.rowFade, t.ease.in),
    });
    return steps;
  }

  steps.push({
    target: "bar",
    keyframes: [
      { transform: "scale(1)" },
      { transform: `scale(${w.breath})` },
      { transform: "scale(1)" },
    ],
    options: at(0, w.breathMs, EASES.bascule!, "none"),
  });
  if (w.sheen && !shape.eco) {
    steps.push({
      target: "sheen",
      keyframes: [{ transform: "translateX(-100%)" }, { transform: "translateX(100%)" }],
      options: at(w.sheenAt, w.sheenMs, EASES.bascule!),
    });
  }
  for (let i = 0; i < shape.rows; i++) {
    const delay = w.rowAt + i * w.rowStep;
    steps.push({
      target: { row: i },
      keyframes: [{ transform: `translateY(${-w.rowRise}px)` }, { transform: "translateY(0px)" }],
      options: at(delay, w.rowMs, w.rowSpring),
    });
    steps.push({
      target: { row: i },
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: at(delay, w.rowFade, t.ease.in),
    });
    for (let j = 0; j < (shape.chips[i] ?? 0); j++) {
      steps.push({
        target: { chip: [i, j] },
        keyframes: [{ transform: `scale(${w.chipFrom})` }, { transform: "scale(1)" }],
        options: at(delay + w.chipAfter + j * w.chipStep, w.chipMs, w.springV),
      });
    }
  }
  return steps;
}

/** The folding, from where the boxes are. */
export function foldSteps(t: MotionTokens, eco: boolean, from: From = {}): Step[] {
  const w = t.widget;
  const out = (delay: number, duration: number, easing = t.ease.out) => ({
    delay,
    duration,
    easing,
    fill: OUT,
  });
  if (w.motion === "sobre") {
    const s = w.sober;
    const box = [
      { transform: "scale(1)", opacity: from.content ?? 1 },
      { transform: `scale(${s.from})`, opacity: 0 },
    ];
    return [
      { target: "hull", keyframes: box, options: out(0, s.foldMs) },
      { target: "content", keyframes: box, options: out(0, s.foldMs) },
    ];
  }
  const pose = startPose(w);
  const steps: Step[] = [
    {
      target: "content",
      keyframes: [{ opacity: from.content ?? 1 }, { opacity: 0 }],
      options: out(0, w.foldFade),
    },
    {
      target: "hull",
      keyframes: [{ transform: from.hull?.transform ?? "scaleX(1)" }, { transform: pose.hull }],
      options: out(w.foldAt, w.foldMs),
    },
    {
      target: "inner",
      keyframes: [
        { transform: from.inner ?? "translateY(0px) scaleY(1)" },
        { transform: pose.inner },
      ],
      options: out(w.foldAt, w.foldMs),
    },
    {
      target: "hull",
      keyframes: [{ opacity: from.hull?.opacity ?? 1 }, { opacity: 0 }],
      options: out(w.foldAt + w.foldMs - w.foldVanish, w.foldVanish, "linear"),
    },
  ];
  if (w.halo && !eco) {
    steps.push({
      target: "halo",
      keyframes: [{ opacity: from.halo ?? 1 }, { opacity: 0 }],
      options: out(0, w.foldFade),
    });
  }
  return steps;
}

/** How long the panel must stay mounted while it folds (ms). */
export function foldDuration(t: MotionTokens): number {
  const w = t.widget;
  return w.motion === "sobre" ? w.sober.foldMs : w.foldAt + w.foldMs;
}
