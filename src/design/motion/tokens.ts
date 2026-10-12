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
 * A level switched off (workshop) or "reduce motion" = final state at once.
 */
import type { ElementValues } from "../da/daParams";
import { SPRINGS } from "../glass/pillMotion";
import { EASES } from "./eases";
import {
  linearCss,
  ROW_SPRING,
  SPRING_H,
  SPRING_V,
  UNROLL_SPRINGS,
  type UnrollSpring,
} from "./springCurves";

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
  widgetMotion: "deroule",
  /** Elasticity of the unrolling: douce / normale / forte (springCurves.ts). */
  widgetSpring: "normale",
  /** Round 4b: float of the empty category's card (px). */
  emptyFloat: 4,
} as const;

/** Ways the widget's panel opens (workshop): the validated unrolling, or the first proposal. */
export const WIDGET_MOTIONS = ["deroule", "sobre"] as const;
export type WidgetMotion = (typeof WIDGET_MOTIONS)[number];

/**
 * Round 4b — the widget's panel unrolls (R4b-3c-Widget.txt): the glass shell unrolls downwards
 * (vertical spring) and widens (horizontal spring), the rows come one by one behind its edge.
 * Times in ms at speed 1. The only "level 3"-like motion of the widget, played as level 2.
 */
export const WIDGET_UNROLL = {
  /** Start pose of the shell: a thin band under the bar. */
  fromScaleY: 0.04,
  fromY: -12,
  fromScaleX: 0.86,
  vMs: 680,
  hMs: 560,
  /** The shell fades in fast (the band is not seen before it moves). */
  hullFade: 60,
  chevronMs: 520,
  breath: 1.02,
  breathMs: 460,
  /** Soft halo under the panel (colour A): lit while the panel is open. */
  haloAt: 80,
  haloMs: 700,
  haloAlpha: 0.3,
  /** Rows (search, scenes, running, recents): 50 / 110 / 170 / 230 ms. */
  rowAt: 50,
  rowStep: 60,
  rowRise: 10,
  rowFade: 260,
  rowMs: 520,
  /** Pills of « En cours » and icons of « Récents », one by one after their row. */
  chipAfter: 50,
  chipStep: 35,
  chipFrom: 0.7,
  chipMs: 460,
  /** A light band sweeps the glass once. */
  sheenAt: 380,
  sheenMs: 950,
  /** Folding: fast, no bounce. */
  foldFade: 100,
  foldAt: 70,
  foldMs: 240,
  foldVanish: 90,
} as const;

/** The first proposal of 3c ("sobre"): content 0.94 → 1 with a fade, rows 30 ms apart. */
export const WIDGET_SOBER = { from: 0.94, ms: 240, rowStep: 30, foldMs: 180 } as const;

/** Round 4b — the scene editor's chain of points (R4b-3c-Editeur.txt). Times in ms. */
export const CHAIN = {
  /** A new point grows from × 0.4, a little after its card. */
  pointFrom: 0.4,
  pointDelay: 120,
  /** The running step's point. */
  active: 1.18,
  /** Demo pace of the workshop (a real test follows the real steps). */
  demoLaunch: 520,
  demoWait: 900,
} as const;

/** Round 4b — empty states and errors (R4b-Etats.txt). Times in ms. */
export const STATES = {
  floatPeriod: 5000,
  /** A card whose app did not launch shakes once: 5 px, then 3 px. */
  shake: [5, 3] as const,
  shakeMs: 240,
  /** How long the message stays. */
  noticeMs: 6000,
} as const;

/** Speed multiplier of the workshop: durations are divided by it (as `opening.speed`). */
export const SPEEDS = ["0.7", "1", "1.5"] as const;

export type DurKey = "micro" | "court" | "moyen" | "long";
export type Level = 1 | 2 | 3;

export interface MotionTokens {
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
  widget: WidgetTokens;
  chain: { [K in keyof typeof CHAIN]: number };
  states: {
    floatPeriod: number;
    shake: readonly [number, number];
    shakeMs: number;
    noticeMs: number;
    /** Float of the empty category's card (px). */
    emptyFloat: number;
  };
}

type Unroll = typeof WIDGET_UNROLL;
export type WidgetTokens = { [K in keyof Unroll]: number } & {
  motion: WidgetMotion;
  spring: UnrollSpring;
  /** CSS `linear()` of the vertical and horizontal springs, and of the rows (3.5 %). */
  springV: string;
  springH: string;
  rowSpring: string;
  halo: boolean;
  sheen: boolean;
  sober: { [K in keyof typeof WIDGET_SOBER]: number };
};

/** Keys of WIDGET_UNROLL that are times (divided by the speed). */
const UNROLL_TIMES = new Set<string>([
  "vMs",
  "hMs",
  "hullFade",
  "chevronMs",
  "breathMs",
  "haloAt",
  "haloMs",
  "rowAt",
  "rowStep",
  "rowFade",
  "rowMs",
  "chipAfter",
  "chipStep",
  "chipMs",
  "sheenAt",
  "sheenMs",
  "foldFade",
  "foldAt",
  "foldMs",
  "foldVanish",
]);

function widgetTokens(use: ElementValues | undefined, speed: number): WidgetTokens {
  const pick = <T extends string>(k: string, all: readonly T[], d: T): T => {
    const x = use?.[k];
    return typeof x === "string" && (all as readonly string[]).includes(x) ? (x as T) : d;
  };
  const spring = pick("widgetSpring", UNROLL_SPRINGS, D.widgetSpring);
  const unroll = Object.fromEntries(
    Object.entries(WIDGET_UNROLL).map(([k, v]) => [k, UNROLL_TIMES.has(k) ? v / speed : v]),
  ) as { [K in keyof Unroll]: number };
  return {
    ...unroll,
    motion: pick("widgetMotion", WIDGET_MOTIONS, D.widgetMotion),
    spring,
    springV: linearCss(SPRING_V[spring]),
    springH: linearCss(SPRING_H[spring]),
    rowSpring: linearCss(ROW_SPRING),
    halo: use?.widgetHalo !== false,
    sheen: use?.widgetSheen !== false,
    sober: {
      from: WIDGET_SOBER.from,
      ms: WIDGET_SOBER.ms / speed,
      rowStep: WIDGET_SOBER.rowStep / speed,
      foldMs: WIDGET_SOBER.foldMs / speed,
    },
  };
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
  const names = {
    in: curve("easeIn"),
    out: curve("easeOut"),
    move: curve("easeMove"),
    bounce: curve("easeBounce"),
  };
  return {
    speed,
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
    widget: widgetTokens(use, speed),
    chain: {
      ...CHAIN,
      pointDelay: CHAIN.pointDelay / speed,
      demoLaunch: CHAIN.demoLaunch / speed,
      demoWait: CHAIN.demoWait / speed,
    },
    states: {
      ...STATES,
      floatPeriod: STATES.floatPeriod / speed,
      shakeMs: STATES.shakeMs / speed,
      noticeMs: STATES.noticeMs,
      emptyFloat: num("emptyFloat"),
    },
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
    "--m-spring-h": t.widget.springH,
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
