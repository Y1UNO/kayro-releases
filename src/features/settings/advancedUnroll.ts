/**
 * « Personnalisation avancée » opens as a small bouncing drop-down (R5-Personnalisation.txt): the
 * same family as the validated widget. Pure description of each Web Animation, played by
 * `useAdvancedUnroll` with `element.animate()` (composited; WebView2 reads CSS `linear()`).
 *
 * Opening: the shell unrolls downwards on the widget's vertical spring (5 %, 680 ms) and widens on
 * its side spring (2.5 %, 560 ms); the chevron turns 180° on the vertical spring; the rows come
 * one by one (45 ms, −10 px, opacity in 260 ms); a soft halo (not in Eco); what is below the
 * section slides down with the shell. Closing: 220 ms, the « disparition » curve, no bounce, no
 * cascade. Reduced motion: no animation at all. « Mouvement : Net » (review A5): the same steps on
 * the entrance curve, no spring.
 */
import { EASES } from "../../design/motion/eases";
import { linearCss, ROW_SPRING, SPRING_H, SPRING_V } from "../../design/motion/springCurves";
import { ADVANCED_UNROLL as U } from "../../design/motion/tokens5";

export type Target = "hull" | "inner" | "content" | "chevron" | "halo" | "below" | { row: number };

export interface Step {
  target: Target;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions & { delay: number; duration: number };
}

const SV = linearCss(SPRING_V.normale);
const SH = linearCss(SPRING_H.normale);
const SROW = linearCss(ROW_SPRING);

function at(delay: number, duration: number, easing: string, speed: number) {
  return { delay: delay / speed, duration: duration / speed, easing, fill: "backwards" as const };
}

/**
 * Opening of `rows` rows; `belowDy`: how far what follows the section moved down (px); `crisp`:
 * « Mouvement : Net », every spring on the entrance curve.
 */
export function openSteps(
  rows: number,
  belowDy: number,
  eco: boolean,
  speed = 1,
  crisp = false,
): Step[] {
  const [V, H, ROW] = crisp ? [EASES.vive!, EASES.vive!, EASES.vive!] : [SV, SH, SROW];
  const steps: Step[] = [
    {
      target: "hull",
      keyframes: [{ transform: `scaleX(${U.fromScaleX})` }, { transform: "scaleX(1)" }],
      options: at(0, U.hMs, H, speed),
    },
    {
      target: "hull",
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: at(0, U.hullFade, "linear", speed),
    },
    {
      target: "inner",
      keyframes: [{ transform: `scaleY(${U.fromScaleY})` }, { transform: "scaleY(1)" }],
      options: at(0, U.vMs, V, speed),
    },
    {
      target: "chevron",
      // The stylesheet holds the end pose (aria-expanded): no fill after the animation.
      keyframes: [{ transform: "rotate(0deg)" }, { transform: "rotate(180deg)" }],
      options: at(0, U.vMs, V, speed),
    },
  ];
  if (!eco) {
    steps.push({
      target: "halo",
      keyframes: [{ opacity: 0 }, { opacity: U.haloAlpha }],
      options: at(80, U.vMs, EASES.vive!, speed),
    });
  }
  if (belowDy !== 0) {
    steps.push({
      target: "below",
      keyframes: [{ transform: `translateY(${-belowDy}px)` }, { transform: "translateY(0px)" }],
      options: at(0, U.vMs, V, speed),
    });
  }
  for (let i = 0; i < rows; i++) {
    const delay = U.rowAt + i * U.rowStep;
    steps.push({
      target: { row: i },
      keyframes: [{ transform: `translateY(${-U.rowRise}px)` }, { transform: "translateY(0px)" }],
      options: at(delay, U.rowMs, ROW, speed),
    });
    steps.push({
      target: { row: i },
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: at(delay, U.rowFade, "linear", speed),
    });
  }
  return steps;
}

/** Closing: everything goes at once, fast, without a bounce; `height` = the section's (px). */
export function closeSteps(height: number, speed = 1): Step[] {
  const out = EASES.sortie!;
  const fold = (keyframes: Keyframe[], target: Target): Step => ({
    target,
    keyframes,
    options: { delay: 0, duration: U.foldMs / speed, easing: out, fill: "forwards" },
  });
  return [
    fold([{ transform: "scaleY(1)" }, { transform: `scaleY(${U.fromScaleY})` }], "inner"),
    fold([{ opacity: 1 }, { opacity: 0 }], "hull"),
    fold([{ opacity: 1 }, { opacity: 0 }], "content"),
    {
      ...fold([{ transform: "rotate(180deg)" }, { transform: "rotate(0deg)" }], "chevron"),
      options: { delay: 0, duration: U.foldMs / speed, easing: out, fill: "none" },
    },
    fold([{ opacity: 1 }, { opacity: 0 }], "halo"),
    fold([{ transform: "translateY(0px)" }, { transform: `translateY(${-height}px)` }], "below"),
  ];
}

/** Where things sit in the panel that scrolls (px, client coordinates, before any animation). */
export interface RevealBox {
  viewTop: number;
  viewBottom: number;
  /** Top of the section's header row. */
  headTop: number;
  /** Bottom of what must be seen under the section (« Revenir aux réglages par défaut »). */
  endBottom: number;
}

/**
 * How far the panel scrolls once the section is open (review A1): enough to show what follows it,
 * never so far that the header leaves the top (the shell is seen unrolling from it). 0 = stay.
 */
export function revealScroll(b: RevealBox): number {
  const need = b.endBottom + U.revealPad - b.viewBottom;
  const cap = b.headTop - b.viewTop - U.revealTop;
  return Math.max(0, Math.min(need, cap));
}

/** How long the closed content stays mounted (its fold). */
export function foldMs(speed = 1): number {
  return U.foldMs / speed;
}
