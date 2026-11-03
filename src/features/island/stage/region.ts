import type { Box } from "./home";

/**
 * Kysland's music mode: the window's region follows what the page draws. Each part drawn gives a
 * box (moving parts stretched to where they will be soon); boxes are grown by a margin, those
 * that touch are merged (few rectangles), and the result is sent to the core only when something
 * leaves what was sent, or what was sent is much too big, at most 20 times a second. Everywhere
 * else, clicks go to the windows below. Pure (time comes in), tested.
 */

/** Room around each part (logical px): what moves between two sends stays inside. */
export const ROOM = 28;
/** At most this many rectangles (the core takes 24). */
export const MOST = 12;
/** Sends at most this often (s). */
export const EVERY = 0.05;
/** What was sent is shrunk when it has been this many times bigger than needed this long (s). */
const TOO_BIG = 1.8;
const SHRINK_AFTER = 0.3;

export interface Part extends Box {
  /** Speed (px/s): the box reaches where the part will be in a moment. */
  vx?: number;
  vy?: number;
}

/** Where a part may be within `ahead` s, grown by `room`. */
export function reach(p: Part, ahead: number, room: number): Box {
  const dx = (p.vx ?? 0) * ahead;
  const dy = (p.vy ?? 0) * ahead;
  return {
    x0: Math.min(p.x0, p.x0 + dx) - room,
    y0: Math.min(p.y0, p.y0 + dy) - room,
    x1: Math.max(p.x1, p.x1 + dx) + room,
    y1: Math.max(p.y1, p.y1 + dy) + room,
  };
}

const touch = (a: Box, b: Box) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
const join = (a: Box, b: Box): Box => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
});
const area = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);

/** Boxes merged where they touch, then the closest pairs merged until at most `most`. */
export function merge(boxes: readonly Box[], most = MOST): Box[] {
  let list = boxes.map((b) => ({ ...b }));
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (touch(list[i]!, list[j]!)) {
          list[i] = join(list[i]!, list[j]!);
          list.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  while (list.length > most) {
    // The pair whose union adds the least.
    let best = [0, 1, Infinity] as [number, number, number];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const cost = area(join(list[i]!, list[j]!)) - area(list[i]!) - area(list[j]!);
        if (cost < best[2]) best = [i, j, cost];
      }
    }
    const [i, j] = best;
    list[i] = join(list[i]!, list[j]!);
    list = list.filter((_, k) => k !== j);
  }
  return list;
}

const inside = (b: Box, sent: readonly Box[]) =>
  sent.some((s) => b.x0 >= s.x0 && b.y0 >= s.y0 && b.x1 <= s.x1 && b.y1 <= s.y1);

/**
 * Decides when the region is sent. `offer` takes what is drawn now (boxes as drawn, without
 * margin) and answers the rectangles to send, or null.
 */
export class RegionSender {
  private sent: Box[] = [];
  private at = -Infinity;
  private bigSince = -1;

  /** `room`: around each part; `top`: nothing above it (the island's edge, a taskbar there). */
  constructor(
    private room = ROOM,
    private top = -Infinity,
  ) {}

  /** Forgets what was sent (the next offer is sent at once). */
  reset(): void {
    this.sent = [];
    this.at = -Infinity;
    this.bigSince = -1;
  }

  /**
   * What is drawn now (boxes as drawn, with their speed) at `t` (s): the rectangles to send, or
   * null. Sent when a part leaves what was sent (at most 20 times a second), or once what was
   * sent has been much too big for 0.3 s; `force` sends at once (a corridor for a flight).
   */
  offer(parts: readonly Part[], t: number, force = false): Box[] | null {
    const clip = (b: Box): Box | null =>
      b.y1 <= this.top ? null : { ...b, y0: Math.max(b.y0, this.top) };
    const need = parts.map((p) => clip(reach(p, EVERY * 2, 0))).filter((b): b is Box => b !== null);
    if (need.length === 0) return null;
    const out = need.some((b) => !inside(b, this.sent));
    const grown = parts
      .map((p) => clip(reach(p, EVERY * 2, this.room)))
      .filter((b): b is Box => b !== null);
    const next = merge(grown);
    const held = this.sent.reduce((s, b) => s + area(b), 0);
    const tooBig = held > next.reduce((s, b) => s + area(b), 0) * TOO_BIG;
    if (!tooBig) this.bigSince = -1;
    else if (this.bigSince < 0) this.bigSince = t;
    const shrink = tooBig && t - this.bigSince >= SHRINK_AFTER;
    if (!force && (t - this.at < EVERY || (!out && !shrink))) return null;
    this.sent = next;
    this.at = t;
    this.bigSince = -1;
    return next.map((b) => ({
      x0: Math.floor(b.x0),
      y0: Math.floor(b.y0),
      x1: Math.ceil(b.x1),
      y1: Math.ceil(b.y1),
    }));
  }
}

/** All the parts as one box, inside the stage `W` × `H` (empty: x1 < x0). */
export function boundsOf(parts: readonly Box[], W: number, H: number): Box {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    [x0, y0] = [Math.min(x0, p.x0), Math.min(y0, p.y0)];
    [x1, y1] = [Math.max(x1, p.x1), Math.max(y1, p.y1)];
  }
  return { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(W, x1), y1: Math.min(H, y1) };
}

/**
 * How far light around (x, y) may reach and fade out before the edges of `box` (the drawn box:
 * past it, nothing is drawn, so light must be gone by then); the stage's own edges cut it anyway.
 */
export function fadeInside(box: Box, x: number, y: number, W: number, H: number): number {
  const gaps: number[] = [];
  if (box.x0 > 0.5) gaps.push(x - box.x0);
  if (box.x1 < W - 0.5) gaps.push(box.x1 - x);
  if (box.y0 > 0.5) gaps.push(y - box.y0);
  if (box.y1 < H - 0.5) gaps.push(box.y1 - y);
  return gaps.length ? Math.max(20, Math.min(...gaps)) : 1e5;
}
