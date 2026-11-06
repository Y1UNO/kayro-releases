import type { PointerEvent } from "react";
import { daStore } from "../../design/da";
import { setGlassTilt } from "../../design/glass/glassRegistry";
import { CARD_TILT } from "../../design/motion/tokensReview";
import { liveCadence } from "../../fx/cadenceCap";
import { frameLoop, type Unsubscribe } from "../../fx/loop";
import { prefersReducedMotion } from "../../fx/motionPref";
import { PointerFrame } from "../../fx/pointerFrame";

/**
 * Hover of the cards (art direction `cardHover`): a 3D tilt towards the pointer and a reflection
 * that follows it. Written straight on the element (`rotate` and two custom properties): no React
 * render per pointer move. Step 13: once per frame whatever the mouse sends.
 * Review 2026-10-29: the tilt is eased here (no CSS transition), on the frame loop, before the
 * glass engine measures: the engine draws the card's glass, poster and lights tilted the same way
 * (`setGlassTilt`), so the card turns as one object. Off with "reduce motion".
 */
export const tiltFrame = new PointerFrame<HTMLElement>((el, _el, x, y) => applyTilt(el, x, y));

interface TiltState {
  /** Current and target tilt about the x and y axes (deg). */
  x: number;
  y: number;
  tx: number;
  ty: number;
}

const states = new Map<HTMLElement, TiltState>();
let off: Unsubscribe | null = null;

export const cardTilt = {
  onPointerMove(e: PointerEvent<HTMLElement>) {
    tiltFrame.push(e.currentTarget, e.currentTarget, e.clientX, e.clientY);
  },
  onPointerLeave(e: PointerEvent<HTMLElement>) {
    tiltFrame.cancel(e.currentTarget);
    aim(e.currentTarget, 0, 0);
  },
};

/** The tilt for a pointer at (x, y) over the card `el`. */
export function applyTilt(el: HTMLElement, x: number, y: number): void {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const nx = Math.max(-1, Math.min(1, ((x - r.left) / r.width) * 2 - 1));
  const ny = Math.max(-1, Math.min(1, ((y - r.top) / r.height) * 2 - 1));
  el.style.setProperty("--sheen-x", `${((nx + 1) * 50).toFixed(1)}%`);
  el.style.setProperty("--sheen-y", `${((ny + 1) * 50).toFixed(1)}%`);
  const hover = daStore.getState().values.cardHover;
  const max = hover?.on ? (hover.tilt as number) : 0;
  if (max <= 0 || prefersReducedMotion()) {
    aim(el, 0, 0, true);
    return;
  }
  // The side under the pointer goes slightly back: about x by −ny, about y by nx (a disc, not a
  // square: the corners do not tilt more than the sides).
  const mag = Math.min(1, Math.hypot(nx, ny));
  const k = mag > 0 ? (max * mag) / Math.hypot(nx, ny) : 0;
  aim(el, -ny * k, nx * k);
}

/** Sets the target tilt of a card (deg); `now` = no easing. */
function aim(el: HTMLElement, tx: number, ty: number, now = false): void {
  let s = states.get(el);
  if (!s) {
    if (tx === 0 && ty === 0) return;
    s = { x: 0, y: 0, tx, ty };
    states.set(el, s);
  }
  s.tx = tx;
  s.ty = ty;
  if (now) {
    s.x = tx;
    s.y = ty;
  }
  off ??= frameLoop().subscribe((dt) => step(dt), liveCadence().pointer, true);
}

/** Eases every card towards its target; lets go of the loop once all are still. */
export function step(dt: number): void {
  for (const [el, s] of states) {
    const tau = s.tx === 0 && s.ty === 0 ? CARD_TILT.leaveMs : CARD_TILT.followMs;
    const k = 1 - Math.exp(-Math.max(0, dt) / tau);
    s.x += (s.tx - s.x) * k;
    s.y += (s.ty - s.y) * k;
    const still = Math.abs(s.tx - s.x) < 0.01 && Math.abs(s.ty - s.y) < 0.01;
    if (still) {
      s.x = s.tx;
      s.y = s.ty;
    }
    write(el, s.x, s.y);
    if (still && s.tx === 0 && s.ty === 0) states.delete(el);
  }
  if (states.size === 0 && off) {
    off();
    off = null;
  }
}

const DEG = Math.PI / 180;

/** The card and the layer of its light threads (a carousel card, round 4a) tilt together. */
function write(el: HTMLElement, ax: number, ay: number): void {
  const angle = Math.hypot(ax, ay);
  const rotate =
    angle < 0.005
      ? ""
      : `${(ax / angle).toFixed(4)} ${(ay / angle).toFixed(4)} 0 ${angle.toFixed(3)}deg`;
  el.style.rotate = rotate;
  const rim = el.parentElement?.querySelector<HTMLElement>(":scope > [data-rim]");
  if (rim) rim.style.rotate = rotate;
  setGlassTilt(el, rotate ? { x: ax * DEG, y: ay * DEG, persp: CARD_TILT.perspective } : null);
}
