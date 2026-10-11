/**
 * Liquid slide of a selection pill (art direction `glassPills`): the leading edge leaves first and
 * the trailing edge catches up, so the pill stretches on the way and gathers again at the end;
 * its height gives a little meanwhile. Pure function of the progress (tested).
 *
 * Round 2b: the progress curve can be a light spring (the pill passes its target a little and
 * settles back). Named presets only, never more than MAX_BOUNCE of the travel.
 */
export interface PillBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Overshoot of the travel, by preset (`glassPills.spring`). "net" = no bounce. */
export const SPRINGS: Readonly<Record<string, number>> = {
  net: 0,
  leger: 0.05,
  // Round 3b, unfolding of the category deck: the mock-up's cubic-bezier(.34,1.32,.64,1) passes
  // its target by 3.4 % (motion.test.ts).
  liaison: 0.034,
};
export const MAX_BOUNCE = 0.08;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * Underdamped spring from 0 to 1 over t = 0…1, overshooting by `bounce` (≤ MAX_BOUNCE), settled
 * at t = 1 (envelope < 0.5 %; the remainder is spread linearly so that it ends exactly on 1).
 * bounce = 0: the cubic ease of round 2a.
 */
export function springAt(t: number, bounce: number): number {
  const o = Math.min(MAX_BOUNCE, Math.max(0, bounce));
  const u = clamp01(t);
  if (o <= 0) return ease(u);
  const lo = Math.log(o);
  const zeta = -lo / Math.sqrt(Math.PI * Math.PI + lo * lo);
  const wn = 5.3 / zeta;
  const wd = wn * Math.sqrt(1 - zeta * zeta);
  const x = (s: number) =>
    1 -
    Math.exp(-zeta * wn * s) *
      (Math.cos(wd * s) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * s));
  return x(u) + (1 - x(1)) * u;
}

/**
 * Box at progress `p` (0–1) from `a` to `b`; `stretch` 0 = rigid slide, 1 = very liquid; `bounce`
 * = overshoot of the spring (0 = no bounce, see SPRINGS).
 */
export function pillAt(a: PillBox, b: PillBox, p: number, stretch: number, bounce = 0): PillBox {
  const s = Math.max(0, stretch);
  const curve = (t: number) => springAt(t, bounce);
  const lead = curve(clamp01(p * (1 + s)));
  const trail = curve(clamp01(p * (1 + s) - s));
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
