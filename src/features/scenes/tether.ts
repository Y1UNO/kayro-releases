/**
 * Step 19b, dragging an app into a scene: the app's frame hangs from the pointer on a short thread
 * of light and follows it with a little physics (a damped spring: it lags, swings and settles).
 * Pure functions of real time (any screen rate); the drawing is in TetherGhost.tsx.
 */

export interface Bob {
  /** The frame's hook (its top centre), px. */
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Length of the thread at rest, px. */
export const THREAD = 46;
/** Spring stiffness (1/s²) and damping ratio: a lively swing that settles in about half a second. */
const STIFFNESS = 140;
const DAMPING = 0.42;
/** Longest step integrated at once (s): a slow frame is cut into steps, never one big jump. */
const MAX_STEP = 1 / 120;
/** The frame tilts along the thread, at most this much (degrees). */
export const MAX_TILT = 28;

/** The frame hanging still under the pointer at (`px`, `py`). */
export function restBob(px: number, py: number): Bob {
  return { x: px, y: py + THREAD, vx: 0, vy: 0 };
}

/** The frame `dtMs` later, pulled towards its rest place under the pointer. */
export function stepBob(bob: Bob, px: number, py: number, dtMs: number): Bob {
  const c = 2 * DAMPING * Math.sqrt(STIFFNESS);
  let { x, y, vx, vy } = bob;
  let left = Math.min(Math.max(0, dtMs) / 1000, 0.1);
  while (left > 0) {
    const h = Math.min(left, MAX_STEP);
    vx += (STIFFNESS * (px - x) - c * vx) * h;
    vy += (STIFFNESS * (py + THREAD - y) - c * vy) * h;
    x += vx * h;
    y += vy * h;
    left -= h;
  }
  return { x, y, vx, vy };
}

/** The frame's tilt (degrees): along the thread, so that it hangs from the pointer. */
export function tiltOf(bob: Bob, px: number, py: number): number {
  const angle = (Math.atan2(px - bob.x, Math.max(1, bob.y - py)) * 180) / Math.PI;
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, angle));
}

/**
 * The thread from the pointer to the hook, as an SVG path: a curve that sags when the frame comes
 * closer than the thread's length (slack), straight when it is pulled.
 */
export function threadPath(px: number, py: number, bob: Bob): string {
  const dist = Math.hypot(bob.x - px, bob.y - py);
  const sag = Math.max(0, THREAD - dist) * 0.6 + 3;
  const mx = (px + bob.x) / 2;
  const my = (py + bob.y) / 2 + sag;
  const f = (n: number) => n.toFixed(1);
  return `M${f(px)} ${f(py)} Q${f(mx)} ${f(my)} ${f(bob.x)} ${f(bob.y)}`;
}
