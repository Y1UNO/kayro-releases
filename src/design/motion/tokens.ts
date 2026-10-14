/**
 * Motion language "Vivant intelligent" (art direction round 4a,
 * reference/animations/R4a-Mouvement-FINAL-Vivant-intelligent.txt): THE table of the interface's
 * motion tokens. Every duration, curve, distance and scale of an interaction comes from here,
 * through the CSS variables `--m-*` (written on <html> by the `motion` element of the catalogue,
 * defaults repeated in motion.css) or `motionTokens()` for script. The signature animations of
 * round 3 (opening, category link, fan) keep their own settings.
 *
 * Three levels of effect ("règle d'intelligence"):
 *  1 "net"    — hover and press of buttons, tabs, fields: no bounce, short;
 *  2 "vivant" — selection pill, switches, panels, notifications, list entries: the "liaison"
 *               spring (3.4 %), cascade, rise of 14 px;
 *  3 "magie"  — the carousel's app cards: the "rebond" spring (6.6 %), veil, light threads.
 * A level switched off or "reduce motion" = final state at once.
 */
import type { ElementValues } from "../da/daParams";
import { SPRINGS } from "../glass/pillMotion";
import { EASES } from "./eases";
import { MOTION_STYLES, type MotionStyle } from "./tokens5";
import {
  chainTokens,
  stateTokens,
  WIDGET_DEFAULTS,
  widgetTokens,
  type ChainTokens,
  type StateTokens,
  type WidgetTokens,
} from "./tokens4b";

export const MOTION_DEFAULTS = {
  /** Durations of an appearance (ms); a disappearance lasts `outShare` × as long. */
  micro: 140,
  court: 240,
  moyen: 360,
  long: 540,
  outShare: 0.7,
  /** Curves (names in EASES). */
  easeIn: "vive",
  easeOut: "sortie",
  easeMove: "liaison",
  easeBounce: "rebond",
  /** Delay between the rows of a list (ms) and rise of what appears (px). */
  cascade: 45,
  rise: 14,
  /** Hover of a button / tab: it rises a hair (px). */
  hoverRise: 1,
  /** Scale of a pressed control, and of a panel when it appears. */
  press: 0.94,
  panelScale: 0.96,
  /** Keyboard focus ring: gap in the background colour, ring A, ring B, halo A (px, alpha). */
  focusGap: 3,
  focusA: 5,
  focusB: 7,
  focusBAlpha: 0.5,
  focusHalo: 26,
  focusHaloAlpha: 0.45,
  /** Level 3: hovered card of the carousel. */
  cardLift: 10,
  cardGrow: 1.03,
  /** Round 4b: the widget's panel unrolls ("deroule") or fades in ("sobre", to compare). */
  widgetMotion: WIDGET_DEFAULTS.widgetMotion,
  /** Elasticity of the unrolling: douce / normale / forte (springCurves.ts). */
  widgetSpring: WIDGET_DEFAULTS.widgetSpring,
  /** Round 4b: float of the empty category's card (px). */
  emptyFloat: 4,
} as const;

/**
 * The light along the category title's rule (round 1, CategoryTitle.tsx): its glide and the delay
 * of the first one after a change of category (ms at speed 1), and its curve (EASES). How often it
 * comes back is a setting of the catalogue (`categoryTitle.underlineShine`).
 */
export const TITLE_SHINE = { sweepMs: 1100, firstAt: 450, ease: "standard" } as const;

/** Speed multiplier: durations are divided by it (as `opening.speed`). */
export const SPEEDS = ["0.7", "1", "1.5"] as const;

export type DurKey = "micro" | "court" | "moyen" | "long";
export type Level = 1 | 2 | 3;

export interface MotionTokens {
  /** Round 5, « Mouvement » of the settings: complete / lively (validated) / crisp. */
  style: MotionStyle;
  speed: number;
  /** Levels 1, 2, 3 switched on. */
  levels: readonly [boolean, boolean, boolean];
  /** Durations (ms), speed applied. */
  dur: Readonly<Record<DurKey, number>>;
  outShare: number;
  /** Curve names (EASES keys) and their CSS. */
  easeNames: { in: string; out: string; move: string; bounce: string };
  ease: { in: string; out: string; move: string; bounce: string };
  cascade: number;
  rise: number;
  hoverRise: number;
  press: number;
  panelScale: number;
  focus: {
    gap: number;
    a: number;
    b: number;
    bAlpha: number;
    halo: number;
    haloAlpha: number;
  };
  cardLift: number;
  cardGrow: number;
  titleShine: { sweepMs: number; firstAt: number; ease: string };
  /** Round 4b (tokens4b.ts). */
  widget: WidgetTokens;
  chain: ChainTokens;
  states: StateTokens;
}

const D = MOTION_DEFAULTS;

/** The element's values (catalogue `motion`), defaults where missing or when it is off. */
export function motionTokens(v: ElementValues | undefined): MotionTokens {
  const use = v?.on !== false ? v : undefined;
  const num = (k: keyof typeof D) => {
    const x = use?.[k];
    return typeof x === "number" && Number.isFinite(x) ? x : (D[k] as number);
  };
  const curve = (k: "easeIn" | "easeOut" | "easeMove" | "easeBounce") => {
    const x = use?.[k];
    return typeof x === "string" && x in EASES ? x : D[k];
  };
  const speed = Math.max(0.1, Number(use?.speed ?? 1) || 1);
  const ms = (k: DurKey) => num(k) / speed;
  // Round 5, « Mouvement : Net »: no bounce anywhere (the moves take the entrance curve).
  const style: MotionStyle = (MOTION_STYLES as readonly unknown[]).includes(use?.style)
    ? (use?.style as MotionStyle)
    : "lively";
  const crisp = style === "crisp";
  const names = {
    in: curve("easeIn"),
    out: curve("easeOut"),
    move: crisp ? curve("easeIn") : curve("easeMove"),
    bounce: crisp ? curve("easeIn") : curve("easeBounce"),
  };
  return {
    speed,
    style,
    levels: [use?.level1 !== false, use?.level2 !== false, use?.level3 !== false],
    dur: { micro: ms("micro"), court: ms("court"), moyen: ms("moyen"), long: ms("long") },
    outShare: num("outShare"),
    easeNames: names,
    ease: {
      in: EASES[names.in]!,
      out: EASES[names.out]!,
      move: EASES[names.move]!,
      bounce: EASES[names.bounce]!,
    },
    cascade: num("cascade") / speed,
    rise: num("rise"),
    hoverRise: num("hoverRise"),
    press: num("press"),
    panelScale: num("panelScale"),
    focus: {
      gap: num("focusGap"),
      a: num("focusA"),
      b: num("focusB"),
      bAlpha: num("focusBAlpha"),
      halo: num("focusHalo"),
      haloAlpha: num("focusHaloAlpha"),
    },
    cardLift: num("cardLift"),
    cardGrow: num("cardGrow"),
    titleShine: {
      sweepMs: TITLE_SHINE.sweepMs / speed,
      firstAt: TITLE_SHINE.firstAt / speed,
      ease: EASES[TITLE_SHINE.ease]!,
    },
    widget: widgetTokens(use, speed),
    chain: chainTokens(speed),
    states: stateTokens(speed, num("emptyFloat")),
  };
}

const pct = (a: number) => `${Math.round(a * 1000) / 10}%`;

/** The focus ring, in the theme's colours (background, A, B). */
export function focusShadow(f: MotionTokens["focus"]): string {
  return [
    `0 0 0 ${f.gap}px var(--bg-mid)`,
    `0 0 0 ${f.a}px var(--grad-a)`,
    `0 0 0 ${f.b}px color-mix(in srgb, var(--grad-b) ${pct(f.bAlpha)}, transparent)`,
    `0 0 ${f.halo}px color-mix(in srgb, var(--grad-a) ${pct(f.haloAlpha)}, transparent)`,
  ].join(", ");
}

/** CSS variables of the table (motion.css derives the per-level durations from them). */
export function motionCss(t: MotionTokens): Record<string, string> {
  const ms = (x: number) => `${Math.round(x * 10) / 10}ms`;
  return {
    "--m-micro": ms(t.dur.micro),
    "--m-court": ms(t.dur.court),
    "--m-moyen": ms(t.dur.moyen),
    "--m-long": ms(t.dur.long),
    "--m-out": String(t.outShare),
    "--m-ease-in": t.ease.in,
    "--m-ease-out": t.ease.out,
    "--m-ease-move": t.ease.move,
    "--m-ease-bounce": t.ease.bounce,
    "--m-cascade": ms(t.cascade),
    "--m-rise": `${t.rise}px`,
    "--m-hover-rise": `${t.hoverRise}px`,
    "--m-press": String(t.press),
    "--m-panel-scale": String(t.panelScale),
    "--m-l1": t.levels[0] ? "1" : "0",
    "--m-l2": t.levels[1] ? "1" : "0",
    "--m-l3": t.levels[2] ? "1" : "0",
    "--m-focus": focusShadow(t.focus),
    "--m-card-lift": `${t.cardLift}px`,
    "--m-card-grow": String(t.cardGrow),
    "--m-spring-v": t.widget.springV,
    "--m-widget-chevron": ms(t.widget.chevronMs),
  };
}

/**
 * Duration (ms) of a motion of `level` as script must play it: 0 when the level is off or with
 * "reduce motion" (final state at once). `out` = a disappearance (× outShare).
 */
export function durOf(t: MotionTokens, level: Level, k: DurKey, reduced: boolean, out = false) {
  if (reduced || !t.levels[level - 1]) return 0;
  return t.dur[k] * (out ? t.outShare : 1);
}

/** Overshoot of a curve when script plays it as a spring (SPRINGS; 0 for a curve without one). */
export function springOf(name: string): number {
  return SPRINGS[name] ?? 0;
}

/** The four numbers of a `cubic-bezier()` (Framer Motion's `ease`), or null for `linear`. */
export function bezierOf(css: string): [number, number, number, number] | null {
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(css.replace(/\s+/g, ""));
  const v = m?.[1]?.split(",").map(Number);
  return v && v.length === 4 && v.every(Number.isFinite) ? [v[0]!, v[1]!, v[2]!, v[3]!] : null;
}

/** A Framer Motion transition from the table (seconds), 0 s when the level is off or reduced. */
export function fmTransition(
  t: MotionTokens,
  level: Level,
  k: DurKey,
  curve: keyof MotionTokens["ease"],
  reduced: boolean,
  out = false,
) {
  return {
    duration: durOf(t, level, k, reduced, out) / 1000,
    ease: bezierOf(t.ease[curve]) ?? "linear",
  } as const;
}
