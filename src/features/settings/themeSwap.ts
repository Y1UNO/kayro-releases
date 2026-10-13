/**
 * The theme change (R5-Reglages-Themes.txt §2–4), pure: which way it plays, the card's own impact
 * (keyframes), the sparks, the wave's geometry. Played by `useThemeSwap`.
 *
 * The card itself carries the impact: it rises and grows, is squashed (the impact, 380 ms), then
 * settles on the « liaison » spring. Nothing is laid over it (a separate shape made a « double »,
 * a spectral card). Only then the wave leaves its moon and the new theme is revealed behind it.
 */
import { EASES } from "../../design/motion/eases";
import { THEME_SWAP as S } from "../../design/motion/tokens5";

export type SwapWay = "wave" | "fade" | "direct";

export interface SwapContext {
  /** « Changement de thème » of the settings. */
  setting: SwapWay;
  eco: boolean;
  reduced: boolean;
  /** `document.startViewTransition` exists. */
  viewTransitions: boolean;
  /** The glass engine fell back to CSS (or is off). */
  engineFallback: boolean;
}

/** How the change plays; `card`: the card's rise and squash play first (all but direct). */
export function swapWay(c: SwapContext): { way: SwapWay; card: boolean } {
  if (c.reduced || c.setting === "direct") return { way: "direct", card: false };
  if (c.setting === "fade" || c.eco || !c.viewTransitions || c.engineFallback) {
    return { way: "fade", card: true };
  }
  return { way: "wave", card: true };
}

/** The springs that « Mouvement : Net » replaces by the entrance curve (review A5). */
const SPRING_EASES = new Set(["liaison", "rebond", "ressort"]);

/** A curve of the token table by name, or a written `cubic-bezier(…)`; `crisp`: no overshoot. */
export function easing(name: string, crisp = false): string {
  if (crisp && SPRING_EASES.has(name)) return EASES.vive!;
  return EASES[name] ?? name;
}

/** The card's rise, squash and settle (one animation, 720 ms at speed 1) with its depth. */
export function cardKeyframes(crisp = false): {
  transform: Keyframe[];
  filter: Keyframe[];
  ms: number;
} {
  const end = S.settle.at + S.settle.ms;
  const o = (t: number) => t / end;
  const rise = `translateY(${S.rise.y}px) scale(${S.rise.scale})`;
  const squash = `translateY(${S.squash.y}px) scale(${S.squash.scale})`;
  const rest = "translateY(0px) scale(1)";
  const depth = {
    rest: "drop-shadow(0px 10px 16px rgba(0, 0, 0, 0.38))",
    rise: "drop-shadow(0px 22px 28px rgba(0, 0, 0, 0.46))",
    squash: "drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.42))",
  };
  const at = [0, o(S.squash.at), o(S.impact), 1];
  const eases = [S.rise.ease, S.squash.ease, S.settle.ease].map((e) => easing(e, crisp));
  const frames = (values: string[], prop: "transform" | "filter"): Keyframe[] =>
    values.map((v, i) => ({ offset: at[i], [prop]: v, easing: eases[i] ?? "linear" }));
  return {
    transform: frames([rest, rise, squash, rest], "transform"),
    filter: frames([depth.rest, depth.rise, depth.squash, depth.rest], "filter"),
    ms: end,
  };
}

export interface Spark {
  /** Start on the card's edge (px from its top-left). */
  x: number;
  y: number;
  /** Travel (px). */
  dx: number;
  dy: number;
  delay: number;
}

/** Fixed pseudo-random number in [0, 1) for spark i. */
function seed(i: number, k: number): number {
  const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The 12 sparks: evenly round the card's edge (a little jitter), each leaving along the outward
 * direction from the card's centre, 46 to 82 px, started 0 to 66 ms apart.
 */
export function sparks(w: number, h: number, count: number = S.sparks.count): Spark[] {
  const out: Spark[] = [];
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.35 * seed(i, 1)) / count) * 2 * Math.PI - Math.PI / 2;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    // Where the ray from the centre leaves the box.
    const k = Math.min(Math.abs(w / 2 / (cx || 1e-6)), Math.abs(h / 2 / (cy || 1e-6)));
    const dist = S.sparks.from + (S.sparks.to - S.sparks.from) * seed(i, 2);
    out.push({
      x: w / 2 + cx * k,
      y: h / 2 + cy * k,
      dx: cx * dist,
      dy: cy * dist,
      delay: Math.round(S.sparks.stagger * seed(i, 3)),
    });
  }
  return out;
}

/** Distance from (x, y) to the farthest corner of a w × h view: where the reveal must reach. */
export function farthestCorner(x: number, y: number, w: number, h: number): number {
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

/**
 * The wave and the reveal (the C pulse's own curve and drawing): a circle from the moon (radius
 * `r0`) to the farthest corner, the wave a 400 px ring scaled onto its edge, full until 80 % of the
 * way, then fading out.
 */
export function waveGeometry(x: number, y: number, r0: number, view: { w: number; h: number }) {
  const r1 = farthestCorner(x, y, view.w, view.h);
  const half = S.wave.size / 2;
  return {
    r0,
    r1,
    clip: [`circle(${r0}px at ${x}px ${y}px)`, `circle(${r1}px at ${x}px ${y}px)`],
    /** Scales of the 400 px wave, start and end. */
    scale: [r0 / half, r1 / half] as const,
  };
}
