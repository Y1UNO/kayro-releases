/**
 * Carousel geometry (DESIGN.md): active card 232x324, others 172x246, gap 20, at most 5 visible.
 *
 * Every card lives in a fixed 232x328 slot. A card is moved with `translate` and shrunk with
 * `scale` (SIDE_SCALE), never resized: transform and opacity are the only properties animated,
 * so a held arrow key costs the compositor, not layout and paint. Consequence: the active card is
 * 232x328 (mock-up 324) and the others 172x243 (mock-up 246), within 1.5 % of the mock-up.
 * Everything is a pure function of `d`, the distance to the active card.
 */
export const SLOT = { w: 232, h: 328 } as const;
export const SIDE_W = 172;
/** Scale of a non-active card: 172 / 232. */
export const SIDE_SCALE = SIDE_W / SLOT.w;
export const GAP = 20;
/** Cards at |d| <= VISIBLE_RADIUS are shown (5 visible); the next ring is mounted but transparent. */
export const VISIBLE_RADIUS = 2;
export const MOUNT_RADIUS = VISIBLE_RADIUS + 1;

const STEP = SIDE_W + GAP;

/** Left edge of the *visible* card at distance `d`, measured from the centre of the active card. */
export function cardLeft(d: number): number {
  if (d === 0) return -SLOT.w / 2;
  if (d > 0) return SLOT.w / 2 + GAP + (d - 1) * STEP;
  return -(SLOT.w / 2 + GAP) - SIDE_W - (-d - 1) * STEP;
}

/** `translateX` of the slot (centred on the stage by CSS): its centre is the card's centre. */
export function slotOffset(d: number): number {
  const w = d === 0 ? SLOT.w : SIDE_W;
  return cardLeft(d) + w / 2;
}

export function isVisible(d: number): boolean {
  return Math.abs(d) <= VISIBLE_RADIUS;
}

/** Indices to mount around `focus` (clamped to the list). */
export function mountedRange(focus: number, count: number): [number, number] {
  return [Math.max(0, focus - MOUNT_RADIUS), Math.min(count - 1, focus + MOUNT_RADIUS)];
}

export function clampIndex(i: number, count: number): number {
  return count <= 0 ? 0 : Math.min(count - 1, Math.max(0, i));
}
