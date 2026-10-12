/**
 * Round 4b's part of the motion token table (tokens.ts): the widget's unrolling, the scene
 * editor's chain of points, empty states and errors, the opening's variant C. Kept apart so that
 * tokens.ts stays readable; tokens.ts builds `MotionTokens` from these (one way: nothing here
 * imports tokens.ts).
 */
import type { ElementValues } from "../da/daParams";
import {
  linearCss,
  ROW_SPRING,
  SPRING_H,
  SPRING_V,
  UNROLL_SPRINGS,
  type UnrollSpring,
} from "./springCurves";

/** Ways the widget's panel opens (workshop): the validated unrolling, or the first proposal. */
export const WIDGET_MOTIONS = ["deroule", "sobre"] as const;
export type WidgetMotion = (typeof WIDGET_MOTIONS)[number];

/** Defaults of the `motion` element's round 4b settings (repeated in MOTION_DEFAULTS). */
export const WIDGET_DEFAULTS = {
  widgetMotion: "deroule" as WidgetMotion,
  /** Elasticity of the unrolling: douce / normale / forte (springCurves.ts). */
  widgetSpring: "normale" as UnrollSpring,
};

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

/** Round 4b — opening variant C in the opaque opening (R4b-Ouverture-Transparente.txt). */
export const OPENING_PULSES = ["v1a", "c"] as const;
export const OPENING_C = {
  /** Darkening around the ring until the pulse (as the passages' veil). */
  veil: 0.42,
  /** Margin of the open circle around the ring: its strokes and its glint stay inside. */
  ringMargin: 16,
  /** Wave: a 400 px circle scaled on the circle's edge, full until 80 %, outer glow 5.5 % of r. */
  waveFrom: 400,
  waveFull: 0.8,
  waveBand: 0.055,
  wave: 0.55,
} as const;

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

export type ChainTokens = { [K in keyof typeof CHAIN]: number };

export interface StateTokens {
  floatPeriod: number;
  shake: readonly [number, number];
  shakeMs: number;
  noticeMs: number;
  /** Float of the empty category's card (px). */
  emptyFloat: number;
}

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

/** The widget's tokens from the `motion` element's values (`use`: undefined when it is off). */
export function widgetTokens(use: ElementValues | undefined, speed: number): WidgetTokens {
  const pick = <T extends string>(k: string, all: readonly T[], d: T): T => {
    const x = use?.[k];
    return typeof x === "string" && (all as readonly string[]).includes(x) ? (x as T) : d;
  };
  const spring = pick("widgetSpring", UNROLL_SPRINGS, WIDGET_DEFAULTS.widgetSpring);
  const unroll = Object.fromEntries(
    Object.entries(WIDGET_UNROLL).map(([k, v]) => [k, UNROLL_TIMES.has(k) ? v / speed : v]),
  ) as { [K in keyof Unroll]: number };
  return {
    ...unroll,
    motion: pick("widgetMotion", WIDGET_MOTIONS, WIDGET_DEFAULTS.widgetMotion),
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

/** The chain of points at `speed`. */
export function chainTokens(speed: number): ChainTokens {
  return {
    ...CHAIN,
    pointDelay: CHAIN.pointDelay / speed,
    demoLaunch: CHAIN.demoLaunch / speed,
    demoWait: CHAIN.demoWait / speed,
  };
}

/** Empty states and errors at `speed`; `emptyFloat` from the `motion` element. */
export function stateTokens(speed: number, emptyFloat: number): StateTokens {
  return {
    ...STATES,
    floatPeriod: STATES.floatPeriod / speed,
    shakeMs: STATES.shakeMs / speed,
    noticeMs: STATES.noticeMs,
    emptyFloat,
  };
}
