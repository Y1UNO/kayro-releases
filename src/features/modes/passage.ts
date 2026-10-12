/**
 * Passages between display modes (art direction round 4b, R4b-Modes.txt), fade version: the
 * windows stay opaque (spike 4b-2.0), so the page fades its content out on its opaque background,
 * the core changes the window while nothing shows, and the page comes back in a cascade. A window
 * built for a passage (`?enter=1`) starts faded out and comes in on its first show. Timings from
 * the motion table: out = micro, in = moyen (level 2), the cards rise in a cascade.
 * « Réduire les animations », level 2 off or Éco: the change is direct, as before (R4b-Modes:
 * « Économie : idem + pas de cascade »).
 */
import type { MotionTokens } from "../../design/motion/tokens";

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
