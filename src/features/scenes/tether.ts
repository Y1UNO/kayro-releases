/**
 * Step 19b–19c, dragging an app into a scene: the app's frame hangs from the pointer on a thread of
 * light. The thread is a real rope (Verlet points held at a fixed length: it bends, folds and goes
 * slack), the frame a small body hung from its hook, slowed by the air: pulled to the right, it
 * trails on the left and turns (its top towards the pull), swings, then settles. Fixed time steps
 * (any screen rate), pure numbers; the drawing is in TetherGhost.tsx.
 */

/** Length of the thread at rest, px, and its number of segments. */
export const THREAD = 92;
const SEGMENTS = 12;
/** Hook → middle of the frame (its body hangs below the hook), px. */
const BODY = 24;
/** Gravity (px/s²), the air on the thread (per step) and on the frame (1/s: it trails behind). */
const GRAVITY = 2600;
// 19c, the user: « it bounces and turns far too much, too fast, too often »: more air everywhere.
const ROPE_DAMP = 0.968;
const BODY_DRAG = 3.5;
/** The frame's own swing dies out (per step): it settles instead of rocking. */
const BODY_DAMP = 0.962;
/** Weight of the hook and of the frame against one point of the thread. */
const HOOK_MASS = 4;
const BODY_MASS = 9;
/** Integration step (s) and constraint passes per step. */
const STEP = 1 / 240;
const PASSES = 16;
/** The frame's tilt is capped (degrees). */
export const MAX_TILT = 10;
/** Share of the hanging angle shown as the frame's turn (it leans gently, it does not spin). */
const TILT_SHARE = 0.32;

export interface Rope {
  /** Points of the thread: 0 = at the pointer, last = the frame's hook. */
  x: number[];
  y: number[];
  /** Their positions one step before (Verlet). */
  ox: number[];
  oy: number[];
  /** The middle of the frame's body, now and one step before. */
  bx: number;
  by: number;
  obx: number;
  oby: number;
  /** Time not yet integrated (ms). */
  rest: number;
}

const SEG = THREAD / SEGMENTS;

/**
 * A thread from the pointer (`px`, `py`) to a hook at (`hx`, `hy`) — straight down by default —
 * the frame's body under its hook.
 */
export function makeRope(px: number, py: number, hx = px, hy = py + THREAD): Rope {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const k = i / SEGMENTS;
    x.push(px + (hx - px) * k);
    y.push(py + (hy - py) * k);
  }
  return { x, y, ox: [...x], oy: [...y], bx: hx, by: hy + BODY, obx: hx, oby: hy + BODY, rest: 0 };
}

/** Moves `a` and `b` (inverse masses `wa`, `wb`) to be `len` apart. */
function hold(r: Rope, a: number, b: number, len: number, wa: number, wb: number) {
  const dx = r.x[b]! - r.x[a]!;
  const dy = r.y[b]! - r.y[a]!;
  const d = Math.hypot(dx, dy) || 1e-6;
  const k = (d - len) / d / (wa + wb);
  r.x[a]! += dx * k * wa;
  r.y[a]! += dy * k * wa;
  r.x[b]! -= dx * k * wb;
  r.y[b]! -= dy * k * wb;
}

function stepOnce(r: Rope, px: number, py: number) {
  const n = SEGMENTS;
  const g = GRAVITY * STEP * STEP;
  for (let i = 1; i <= n; i += 1) {
    const vx = (r.x[i]! - r.ox[i]!) * ROPE_DAMP;
    const vy = (r.y[i]! - r.oy[i]!) * ROPE_DAMP;
    r.ox[i] = r.x[i]!;
    r.oy[i] = r.y[i]!;
    r.x[i]! += vx;
    r.y[i]! += vy + g;
  }
  // The body: gravity, and the air slowing it (linear drag).
  const keep = Math.max(0, 1 - BODY_DRAG * STEP) * BODY_DAMP;
  const bvx = (r.bx - r.obx) * keep;
  const bvy = (r.by - r.oby) * keep;
  r.obx = r.bx;
  r.oby = r.by;
  r.bx += bvx;
  r.by += bvy + g;
  r.x[0] = px;
  r.y[0] = py;
  r.ox[0] = px;
  r.oy[0] = py;
  for (let pass = 0; pass < PASSES; pass += 1) {
    // Both ways in turn: no end of the thread is favoured.
    for (let k = 0; k < n; k += 1) {
      const i = pass % 2 === 0 ? k : n - 1 - k;
      const wa = i === 0 ? 0 : 1;
      const wb = i + 1 === n ? 1 / HOOK_MASS : 1;
      hold(r, i, i + 1, SEG, wa, wb);
    }
    // Hook ↔ body: a stiff stick (the frame does not stretch).
    const hx = r.x[n]!;
    const hy = r.y[n]!;
    const dx = r.bx - hx;
    const dy = r.by - hy;
    const d = Math.hypot(dx, dy) || 1e-6;
    const wh = 1 / HOOK_MASS;
    const wbody = 1 / BODY_MASS;
    const k = (d - BODY) / d / (wh + wbody);
    r.x[n] = hx + dx * k * wh;
    r.y[n] = hy + dy * k * wh;
    r.bx -= dx * k * wbody;
    r.by -= dy * k * wbody;
  }
}

/** The rope `dtMs` later, its first point on the pointer (`px`, `py`). Mutates `r`. */
export function stepRope(r: Rope, px: number, py: number, dtMs: number): void {
  // A long pause (hidden window, slow frame) is not caught up: at most 100 ms.
  r.rest = Math.min(r.rest + Math.max(0, dtMs), 100);
  while (r.rest >= STEP * 1000) {
    stepOnce(r, px, py);
    r.rest -= STEP * 1000;
  }
  r.x[0] = px;
  r.y[0] = py;
}

/** Where the frame's hook is (the top middle of the frame). */
export function hookOf(r: Rope): { x: number; y: number } {
  return { x: r.x[SEGMENTS]!, y: r.y[SEGMENTS]! };
}

/**
 * The frame's turn (degrees, clockwise +): along hook → body, so a frame trailing on the left
 * turns its top towards the pull.
 */
export function tiltOf(r: Rope): number {
  const h = hookOf(r);
  const deg = (TILT_SHARE * Math.atan2(-(r.bx - h.x), r.by - h.y) * 180) / Math.PI;
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, deg));
}

/**
 * The thread as one smooth SVG path through its points (midpoint curves). (`ox`, `oy`): where the
 * frame is shown away from its hook (while it comes out of its row): the thread bends to reach it.
 */
export function ropePath(r: Rope, ox = 0, oy = 0): string {
  const f = (v: number) => v.toFixed(1);
  const n = SEGMENTS;
  const X = (i: number) => r.x[i]! + (ox * i) / n;
  const Y = (i: number) => r.y[i]! + (oy * i) / n;
  let d = `M${f(X(0))} ${f(Y(0))}`;
  for (let i = 1; i < n; i += 1) {
    d += ` Q${f(X(i))} ${f(Y(i))} ${f((X(i) + X(i + 1)) / 2)} ${f((Y(i) + Y(i + 1)) / 2)}`;
  }
  return `${d} L${f(X(n))} ${f(Y(n))}`;
}

/** Length of the thread now (for tests: it must not stretch). */
export function ropeLength(r: Rope): number {
  let len = 0;
  for (let i = 0; i < SEGMENTS; i += 1) {
    len += Math.hypot(r.x[i + 1]! - r.x[i]!, r.y[i + 1]! - r.y[i]!);
  }
  return len;
}
