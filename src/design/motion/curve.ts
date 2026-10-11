/**
 * Timing curves of the scripted sequences (art direction round 3): the CSS `cubic-bezier()`
 * curves of the mock-ups, evaluated in script so that a sequence is a pure function of time
 * (seekable, testable). Springs stay in `springAt` (src/design/glass/pillMotion.ts, SPRINGS table).
 */

export type Curve = (t: number) => number;

const clamp01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t);

/** CSS `cubic-bezier(x1, y1, x2, y2)`: y at time t (Newton steps, then bisection). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Curve {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (s: number) => ((ax * s + bx) * s + cx) * s;
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  const y = (s: number) => ((ay * s + by) * s + cy) * s;
  return (t) => {
    const u = clamp01(t);
    if (u === 0 || u === 1) return u;
    let s = u;
    for (let i = 0; i < 6; i++) {
      const e = x(s) - u;
      if (Math.abs(e) < 1e-6) return y(s);
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    let lo = 0;
    let hi = 1;
    s = u;
    for (let i = 0; i < 30; i++) {
      const v = x(s);
      if (Math.abs(v - u) < 1e-6) break;
      if (v < u) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return y(s);
  };
}

export const linear: Curve = clamp01;

const NAMED: Readonly<Record<string, [number, number, number, number]>> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

const cache = new Map<string, Curve>();

/** A CSS timing function (`cubic-bezier(…)`, `ease`…, `linear`) as a curve; unknown → linear. */
export function curveOf(css: string): Curve {
  const key = css.replace(/\s+/g, "");
  const hit = cache.get(key);
  if (hit) return hit;
  let c: Curve = linear;
  const named = NAMED[key];
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(key);
  if (named) c = cubicBezier(...named);
  else if (m) {
    const v = m[1]!.split(",").map(Number);
    if (v.length === 4 && v.every(Number.isFinite)) c = cubicBezier(v[0]!, v[1]!, v[2]!, v[3]!);
  }
  cache.set(key, c);
  return c;
}

/** Progress 0–1 of a segment starting at `delay` and lasting `dur` (ms), through `curve`. */
export function seg(t: number, delay: number, dur: number, curve: Curve = linear): number {
  if (dur <= 0) return t >= delay ? 1 : 0;
  return curve((t - delay) / dur);
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
