import type { Quality } from "../design";

/**
 * What the atmosphere may do at each quality level (ARCHITECTURE.md §5). Ultra = High until the
 * WebGL engine exists. Eco keeps the fog, but static (deliberate deviation from §5: a static
 * gradient is painted once and costs nothing per frame).
 */
export interface FxBudget {
  /** `animated`: slow drift (transform only, driven by the frame loop). */
  fog: "static" | "animated";
  /** Light beam above the selected card. */
  beam: boolean;
  /** ±3° sway of the beam (continuous). */
  sway: boolean;
  /** Halo under the selected card (glides to the selection, no continuous animation). */
  halo: boolean;
  /** Dust particles at the reference size (1280×760); scaled by `dustCount`. */
  dust: number;
  /**
   * Share of the embers and stars kept (art direction, step 12b): fewer in Eco and Balanced
   * (brief: "moins de particules, 30 images/s" in Eco). 0 = none. Their slow drift, the veils and
   * the ring's reflection only move when `fog` is "animated".
   */
  particles: number;
  /**
   * Cadence of everything that moves continuously (fog drift, sway, dust), on the loop's shared
   * grid. Measured at step 8: what costs is the number of images composed per second, not one
   * layer or another (one CSS animation alone at 279 Hz: 6.9 % CPU and 9 % of frames missed).
   */
  maxFps: number;
}

/** Atmosphere cadence at High / Ultra (step 8 measurements, see ROADMAP.md). */
export const AMBIENT_FPS = 60;
/** Never faster than this (PLAN.md « Cadence »: min(Hz, 144)). */
export const FX_MAX_FPS = 144;
/** Eco frame limit (ARCHITECTURE.md §5). */
export const ECO_MAX_FPS = 30;

/**
 * Frame-rate caps of the glass engine and what follows it (step 13, measured in production:
 * docs/PERF-ETAPE13.md). High and Balanced only; Ultra keeps the uncapped cadence (only the
 * dialog cap applies), Eco stays at 30. Raise a value if the eye sees it stutter.
 */
export const CADENCE = {
  /** Only the pointer moves (cursor light, card tilt, the fan's hover): was the display rate. */
  pointerOnly: 60,
  /** A dialog covers the scene under its scrim (not frozen: the ambience keeps breathing). */
  underDialog: 30,
  /** At rest, only the ambience moves (particles, bokeh, ring, moon): was 60. */
  restHigh: 30,
  /** A scripted sequence (category link, return, tab): DOM and engine on the same grid. */
  sequence: 60,
  /**
   * A glass element moved in the DOM (float, tilt, hover lift, scroll): the engine measures every
   * glass box at this rate (forced layouts: the main cost of a hover, step 13 trace). Was 144. If
   * the glass is seen lagging behind a card that moves, raise it back to 144 (`FX_MAX_FPS`).
   */
  glassFollow: 60,
} as const;

/** Cadences in use at a quality level (frames per second; 0 never: every value is a cap). */
export interface Cadence {
  ambient: number;
  pointer: number;
  sequence: number;
  /** A glass element moved in the DOM (CSS transition, scroll): follow it at this rate. */
  glass: number;
}

export function cadenceFor(quality: Quality): Cadence {
  if (quality === "eco")
    return {
      ambient: ECO_MAX_FPS,
      pointer: ECO_MAX_FPS,
      sequence: ECO_MAX_FPS,
      glass: ECO_MAX_FPS,
    };
  if (quality === "ultra")
    return { ambient: AMBIENT_FPS, pointer: FX_MAX_FPS, sequence: FX_MAX_FPS, glass: FX_MAX_FPS };
  return {
    ambient: CADENCE.restHigh,
    pointer: CADENCE.pointerOnly,
    sequence: CADENCE.sequence,
    glass: CADENCE.glassFollow,
  };
}

/** Every cadence held at `CADENCE.underDialog` at most (a dialog is open). */
export function underDialog(c: Cadence): Cadence {
  const cap = (x: number) => Math.min(x, CADENCE.underDialog);
  return {
    ambient: cap(c.ambient),
    pointer: cap(c.pointer),
    sequence: cap(c.sequence),
    glass: cap(c.glass),
  };
}

const BUDGETS: Record<Quality, FxBudget> = {
  eco: {
    fog: "static",
    beam: false,
    sway: false,
    halo: true,
    dust: 0,
    particles: 0.5,
    maxFps: ECO_MAX_FPS,
  },
  balanced: {
    fog: "static",
    beam: false,
    sway: false,
    halo: true,
    dust: 0,
    particles: 0.5,
    maxFps: AMBIENT_FPS,
  },
  high: {
    fog: "animated",
    beam: true,
    sway: true,
    halo: true,
    dust: 14,
    particles: 1,
    maxFps: AMBIENT_FPS,
  },
  ultra: {
    fog: "animated",
    beam: true,
    sway: true,
    halo: true,
    dust: 14,
    particles: 1,
    maxFps: AMBIENT_FPS,
  },
};

/** `reducedMotion`: no sway, no particles, static fog (DESIGN.md « Mouvement »). */
export function budgetFor(quality: Quality, reducedMotion: boolean): FxBudget {
  const b = BUDGETS[quality];
  return reducedMotion ? { ...b, fog: "static", sway: false, dust: 0, particles: 0 } : b;
}

/** Mock-up frame: the reference for particle density. */
const REF_AREA = 1280 * 760;
/** "Reduced counts" (§5): never more than twice the mock-up's 14 particles. */
const MAX_DUST_SCALE = 2;

/** Particles for a viewport, keeping the mock-up's density up to a cap. */
export function dustCount(base: number, width: number, height: number): number {
  if (base <= 0 || width <= 0 || height <= 0) return 0;
  const scale = Math.min(MAX_DUST_SCALE, Math.max(1, (width * height) / REF_AREA));
  return Math.round(base * scale);
}

/** Cadence of the continuous layers; `override` (dev bench) wins, never above 144. */
export function fxFps(budget: FxBudget, override?: number): number {
  const fps = override && override > 0 ? override : budget.maxFps;
  return Math.min(fps > 0 ? fps : FX_MAX_FPS, FX_MAX_FPS);
}
