import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { prefersReducedMotion } from "../../fx/motionPref";

/** How long the rows take to fall into place (ms), and how far past it they bounce (px). */
const FALL_MS = 460;
const BOUNCE = 5;

/**
 * Step 19c, « Mes apps »: an app put in the scene leaves the list and the rows under it fall up
 * into its place, as if pulled by a gravity going up: they slide, go a little past, and settle.
 * FLIP on the rows (`[data-row-key]`, places inside the list: a scroll does not count), transform
 * only; nothing with reduced motion.
 */
export function useFallUp(list: RefObject<HTMLElement | null>, layoutKey: string): void {
  const places = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const glide = !prefersReducedMotion();
    const next = new Map<string, number>();
    for (const row of el.querySelectorAll<HTMLElement>("[data-row-key]")) {
      const key = row.dataset.rowKey ?? "";
      const top = row.offsetTop;
      next.set(key, top);
      const before = places.current.get(key);
      const dy = before === undefined ? 0 : before - top;
      if (glide && Math.abs(dy) > 0.5) {
        const past = dy > 0 ? -BOUNCE : BOUNCE;
        row.animate(
          [
            { transform: `translateY(${dy}px)` },
            { transform: `translateY(${past}px)`, offset: 0.68 },
            { transform: `translateY(${-past * 0.3}px)`, offset: 0.86 },
            { transform: "none" },
          ],
          { duration: FALL_MS, easing: "cubic-bezier(0.5, 0, 0.3, 1)" },
        );
      }
    }
    places.current = next;
  }, [list, layoutKey]);
}
