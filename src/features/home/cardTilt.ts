import type { PointerEvent } from "react";
import { daStore } from "../../design/da";

const reduced =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

/**
 * Hover of the cards (art direction `cardHover`): a 3D tilt of at most a few degrees towards the
 * pointer and a reflection that follows it. Written straight on the element (`rotate` and two
 * custom properties): no React render per pointer move. The lift and the return to rest are CSS
 * transitions (AppCard.module.css). Off with "reduce motion".
 */
export const cardTilt = {
  onPointerMove(e: PointerEvent<HTMLElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    el.style.setProperty("--sheen-x", `${((nx + 1) * 50).toFixed(1)}%`);
    el.style.setProperty("--sheen-y", `${((ny + 1) * 50).toFixed(1)}%`);
    const hover = daStore.getState().values.cardHover;
    const max = hover?.on ? (hover.tilt as number) : 0;
    const mag = Math.min(1, Math.hypot(nx, ny));
    if (max <= 0 || mag < 0.01 || reduced?.matches) {
      tilt(el, "");
      return;
    }
    // Axis (-ny, nx): the side under the pointer goes slightly back.
    tilt(el, `${(-ny).toFixed(3)} ${nx.toFixed(3)} 0 ${(max * mag).toFixed(2)}deg`);
  },
  onPointerLeave(e: PointerEvent<HTMLElement>) {
    tilt(e.currentTarget, "");
  },
};

/** The card and the layer of its light threads (a carousel card, round 4a) tilt together. */
function tilt(el: HTMLElement, rotate: string): void {
  el.style.rotate = rotate;
  const rim = el.parentElement?.querySelector<HTMLElement>(":scope > [data-rim]");
  if (rim) rim.style.rotate = rotate;
}
