/**
 * Timing of the glossy veil of the selected card (art direction `cardSheen`, round 2b): a band of
 * light glides across the card in `glideMs`, then rests (nothing moves, no frame drawn) for the
 * rest of the cycle. The glide takes GLIDE_SHARE of the cycle. Pure functions (tested), shared by
 * the engine (glassShader.ts) and the CSS veil drawn above a DOM poster (SheenVeil.tsx).
 */
export const GLIDE_SHARE = 0.3;
/** With "reduce motion": the band stays still, here, dimmer. */
export const STILL_AT = 0.38;
export const STILL_DIM = 0.6;

export function sheenCycle(glideMs: number): number {
  return Math.max(1, glideMs) / GLIDE_SHARE;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Band position 0 (before the card) … 1 (past it) at time `t` (ms), or −1 while it rests. */
export function sheenAt(t: number, glideMs: number): number {
  const cycle = sheenCycle(glideMs);
  const local = (((t % cycle) + cycle) % cycle) / Math.max(1, glideMs);
  return local < 1 ? easeInOut(local) : -1;
}
