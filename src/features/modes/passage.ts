/**
 * Passages between display modes (art direction round 4b, R4b-Modes.txt), fade version: the
 * windows stay opaque (spike 4b-2.0), so the page fades its content out on its opaque background,
 * the core changes the window while nothing shows, and the page comes back in a cascade. A window
 * built for a passage (`?enter=1`) starts faded out and comes in on its first show. Timings from
 * the motion table: out = micro, in = moyen (level 2), the cards rise in a cascade.
 * « Réduire les animations », level 2 off or Éco: the change is direct, as before (R4b-Modes:
 * « Économie : idem + pas de cascade »).
 */
import { curveOf } from "../../design/motion/curve";
import type { MotionTokens } from "../../design/motion/tokens";
import type { VeilFade } from "../../ipc/bindings";

export interface PassagePlan {
  /** Nothing to play: the change is direct. */
  instant: boolean;
  out: { duration: number; easing: string };
  in: { duration: number; easing: string };
  /** The cards of the home screen rise back one after the other. */
  cascade: { step: number; rise: number; duration: number; easing: string; max: number };
  /** The widget comes in: a fade with a slight growth. */
  widgetFrom: number;
}

/** At most this many cards cascade (the next ones come with the last). */
const CASCADE_MAX = 12;

export function passagePlan(t: MotionTokens, eco: boolean, reduced: boolean): PassagePlan {
  return {
    instant: reduced || eco || !t.levels[1],
    out: { duration: t.dur.micro, easing: t.ease.out },
    in: { duration: t.dur.moyen, easing: t.ease.in },
    cascade: {
      step: t.cascade,
      rise: t.rise,
      duration: t.dur.moyen,
      easing: t.ease.move,
      max: CASCADE_MAX,
    },
    widgetFrom: t.panelScale,
  };
}

/** Delay of the card at `index` in the cascade. */
export function cascadeDelay(plan: PassagePlan, index: number): number {
  return Math.min(index, plan.cascade.max - 1) * plan.cascade.step;
}

/** Samples of a curve for the core's native veil (it plays them, linear in between). */
const VEIL_SAMPLES = 16;

/**
 * How the native veil fades between `main` and the widget (round 4b, option A), sent by the page
 * that faded out: `main` (opaque) gives way to the widget → its dark veil fades into the desktop
 * (a disappearance: 0.7 × court, disappearance curve); the widget gives way to `main` → a veil
 * darkens the place of `main` (an appearance: court, appearance curve). `rgb`: the colour the
 * page faded to.
 */
export function veilFade(
  t: MotionTokens,
  from: "main" | "widget",
  rgb: readonly [number, number, number],
): VeilFade {
  const leaving = from === "main";
  const curve = curveOf(leaving ? t.ease.out : t.ease.in);
  return {
    r: rgb[0],
    g: rgb[1],
    b: rgb[2],
    ms: Math.round(t.dur.court * (leaving ? t.outShare : 1)),
    curve: Array.from({ length: VEIL_SAMPLES + 1 }, (_, i) => curve(i / VEIL_SAMPLES)),
  };
}

/** `rgb(15, 10, 22)` / `rgba(…)` → [15, 10, 22]; null when unreadable. */
export function parseRgb(css: string): [number, number, number] | null {
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(css.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
