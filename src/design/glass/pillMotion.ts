/**
 * Liquid slide of a selection pill (art direction `glassPills`): the leading edge leaves first and
 * the trailing edge catches up, so the pill stretches on the way and gathers again at the end;
 * its height gives a little meanwhile. Pure function of the progress (tested).
 */
export interface PillBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Box at progress `p` (0–1) from `a` to `b`; `stretch` 0 = rigid slide, 1 = very liquid. */
export function pillAt(a: PillBox, b: PillBox, p: number, stretch: number): PillBox {
  const s = Math.max(0, stretch);
  const lead = ease(clamp01(p * (1 + s)));
  const trail = ease(clamp01(p * (1 + s) - s));
  const right = b.x + b.w >= a.x + a.w;
  const [l, r] = right ? [trail, lead] : [lead, trail];
  const left = a.x + (b.x - a.x) * l;
  const end = a.x + a.w + (b.x + b.w - (a.x + a.w)) * r;
  const hh = a.h + (b.h - a.h) * ease(clamp01(p));
  const cy = a.y + a.h / 2 + (b.y + b.h / 2 - (a.y + a.h / 2)) * ease(clamp01(p));
  const w = end - left;
  const base = a.w + (b.w - a.w) * ease(clamp01(p));
  // The more it is stretched, the thinner it gets (a little: at most 12 %).
  const squash = Math.min(0.12, Math.max(0, (w - base) / Math.max(base, 1)) * 0.25);
  const h = hh * (1 - squash);
  return { x: left, y: cy - h / 2, w, h };
}
