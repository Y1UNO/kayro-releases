/**
 * Step 20 (Kysland): the room the island takes at rest, for the core's click region (clicks
 * next to the island reach the windows below). Its size as drawn once its springs settle, docked
 * and floating (the core knows where it is), sent at once when it grows and once the island has
 * shrunk when it shrinks: the region never cuts it. Tested.
 */
import { shapeOf } from "./islandShape";

/** Docked width and height, floating width and height (logical). */
export type Room = readonly [number, number, number, number];

/** What the island shows at rest, and whether the pointer is on it. */
export interface RestState {
  media: boolean;
  stretch: boolean;
  dots: boolean;
  hover: boolean;
  /** The music plays: its bass makes the island breathe (`useBeat`). */
  breath: boolean;
}

/** The breath makes it up to 3 % bigger (Island.module.css `--breath`). */
const BREATH = 1.03;
/** Growing, the springs overshoot by under 5 % of the change (`SPRINGS.rest`, ζ 0.7). */
const OVERSHOOT = 0.06;
/** Shrinking waits for the island to have shrunk (its springs settle sooner). */
export const SHRINK_AFTER_MS = 450;

/** The island's size at rest for what it shows, docked and floating. */
export function islandRoom(s: RestState): Room {
  const at = (morph: number) =>
    shapeOf({
      morph,
      corner: 0,
      hover: s.hover ? 1 : 0,
      pullX: 0,
      pullY: 0,
      vx: 0,
      vy: 0,
      squish: 0,
      presence: 1,
      open: 0,
      media: s.media ? 1 : 0,
      stretch: s.stretch ? 1 : 0,
      dots: s.dots ? 1 : 0,
    });
  const k = s.breath ? BREATH : 1;
  const [docked, floating] = [at(0), at(1)];
  return [docked.width * k, docked.height * k, floating.width * k, floating.height * k];
}

/** A room made value by value (docked width, docked height, floating width, floating height). */
const each = (f: (i: 0 | 1 | 2 | 3) => number): Room => [f(0), f(1), f(2), f(3)];

/**
 * What to send from `sent` to `next`: `now` when it grows (with room for the overshoot), `later`
 * (after `SHRINK_AFTER_MS`) the exact room when it shrinks or once the overshoot is over.
 */
export function roomPlan(sent: Room | null, next: Room): { now: Room | null; later: Room | null } {
  if (!sent) return { now: next, later: null };
  const grows = next.some((v, i) => v > (sent[i] ?? 0));
  const now = grows
    ? each((i) => Math.max(sent[i], next[i] + Math.max(0, next[i] - sent[i]) * OVERSHOOT))
    : null;
  const held = now ?? sent;
  const later = next.some((v, i) => v !== held[i]) ? next : null;
  return { now, later };
}
