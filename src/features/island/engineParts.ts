import type { IslandPassage } from "../../ipc/bindings";
import { OPEN, SPRINGS, SQUISH_LIMIT, type Animated, type Values } from "./islandShape";

/** Step 20 (Kysland): the island engine's options, parts and small helpers. */
export interface EngineOptions {
  /** « Reduce motion »: no overshoot, no bubbles, no glitch. */
  calm: boolean;
  /** Bubbles, drops and glitch (off in Éco). */
  effects: boolean;
  /** « Passage de Kysland » (from one screen to another), and the set of its sounds. */
  passage: IslandPassage;
}

export interface Parts {
  island: HTMLElement | null;
  /** The layer cut to the island's screen (nothing of the island past its bezels). */
  layer: HTMLElement | null;
  canvas: HTMLCanvasElement | null;
}

export type Key = keyof Values | "light";

/** Each animated value's spring. */
export const SPRING_OF: Record<Key, (typeof SPRINGS)[keyof typeof SPRINGS]> = {
  morph: SPRINGS.morph,
  corner: SPRINGS.corner,
  hover: SPRINGS.hover,
  pullX: SPRINGS.pull,
  pullY: SPRINGS.pull,
  vx: SPRINGS.lean,
  vy: SPRINGS.lean,
  squish: SPRINGS.squish,
  presence: SPRINGS.presence,
  open: SPRINGS.open,
  openW: SPRINGS.open,
  openH: SPRINGS.open,
  media: SPRINGS.rest,
  stretch: SPRINGS.rest,
  dots: SPRINGS.rest,
  light: SPRINGS.backdrop,
};

/** Where the values start (0 for the others): the opened size at its first one. */
export const START: Partial<Record<Key, number>> = { openW: OPEN.width, openH: OPEN.height };

/** A number from the core (a non-finite one arrives as null). */
export const num = (v: number | null): number => v ?? 0;

/** The jelly's push is bounded too, so taps in a row never fold the island over. */
export const kickSquish = (a: Animated, by: number): void => {
  a.v = Math.min(Math.max(a.v + by, -14), 14);
  a.x = Math.min(Math.max(a.x, -SQUISH_LIMIT), SQUISH_LIMIT);
};
