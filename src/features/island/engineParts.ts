import type { IslandPassage } from "../../ipc/bindings";
import { desktopIpc } from "../../ipc/commands";
import type { Point } from "./bubbles";
import type { Box, Edge, Glitch } from "./glitch";
import {
  ANCHOR,
  OPEN,
  SPRINGS,
  SQUISH_LIMIT,
  type Animated,
  type Shape,
  type Spring,
  type Values,
} from "./islandShape";

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
export const SPRING_OF: Record<Key, Spring> = {
  morph: SPRINGS.morph,
  corner: SPRINGS.corner,
  hover: SPRINGS.hover,
  pullX: SPRINGS.pull,
  pullY: SPRINGS.pull,
  vx: SPRINGS.lean,
  vy: SPRINGS.lean,
  squish: SPRINGS.squish,
  presence: SPRINGS.presence,
  fade: SPRINGS.presence,
  open: SPRINGS.open,
  openW: SPRINGS.open,
  openH: SPRINGS.open,
  media: SPRINGS.rest,
  stretch: SPRINGS.rest,
  dots: SPRINGS.rest,
  idle: SPRINGS.idle,
  look: SPRINGS.look,
  light: SPRINGS.backdrop,
};

/** Where the values start (0 for the others): the opened size at its first one. */
export const START: Partial<Record<Key, number>> = {
  openW: OPEN.width,
  openH: OPEN.height,
  fade: 1,
};

/** The island's box in the window (logical). */
export const boxOf = (shape: Shape): Box => ({
  x: ANCHOR.x + shape.x - shape.width / 2,
  y: ANCHOR.y + shape.y,
  width: shape.width,
  height: shape.height,
});

/** The top edge where the island meets it (docked: a slide along it ends), on the desktop;
 * `origin`: the window's top-left corner (logical). */
export function topEdgeAt(origin: Point, shape: Shape): Edge {
  const x = origin.x + ANCHOR.x + shape.x;
  const reach = shape.width / 2 + 50;
  const at = origin.y + ANCHOR.y;
  return { vertical: false, at, from: x - reach, to: x + reach, sides: 1 };
}

/** A number from the core (a non-finite one arrives as null). */
export const num = (v: number | null): number => v ?? 0;

/** The jelly's push is bounded too, so taps in a row never fold the island over. */
export const kickSquish = (a: Animated, by: number): void => {
  a.v = Math.min(Math.max(a.v + by, -14), 14);
  a.x = Math.min(Math.max(a.x, -SQUISH_LIMIT), SQUISH_LIMIT);
};

/** Sends the glitch's new held frame (its spikes) to the core's effects layer. */
export function sendEffects(glitch: Glitch, scale: number): void {
  const shapes = glitch.take();
  if (!shapes) return;
  const alpha = Math.min(1, glitch.level * 1.4);
  void desktopIpc.islandEffects({ shapes, alpha, scale });
}
