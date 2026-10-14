import { useEffect, useLayoutEffect } from "react";
import type { RefObject } from "react";
import { currentMotion } from "../../../design/motion/current";
import { durOf } from "../../../design/motion/tokens";
import { prefersReducedMotion } from "../../../fx/motionPref";

/**
 * Where the rows of a list were last seen, kept between renders (one per list, `useState`). An
 * event handler records them with `snapshot()` just before a change it causes: the end of a drag
 * (useDrag's `onEnd`), while the rows still show the drag's shifts.
 */
export class ListMotionState {
  private prev: Map<string, Row> | null = null;
  private list: HTMLElement | null = null;

  /** The list `ol` was laid out anew: where its rows were seen before, and where they are now. */
  next(ol: HTMLElement): { before: Map<string, Row> | null; now: Map<string, Row> } {
    this.list = ol;
    const before = this.prev;
    this.prev = measureRows(ol);
    return { before, now: this.prev };
  }

  /** Rows resized without a change of layout key: measured again, no motion. */
  refresh(ol: HTMLElement): void {
    if (this.list === ol) this.prev = measureRows(ol);
  }

  snapshot(): void {
    if (this.list) this.prev = measureRows(this.list);
  }
}

/**
 * Motion of a list whose rows are added, removed and reordered (art direction round 4b,
 * R4b-3c-Editeur.txt): level 2 of the motion table, Web Animations only (transform, opacity).
 * - a new row rises 14 px and appears (moyen, apparition); its point grows from × 0.4 on the
 *   "liaison" spring (court), a little after it; the thread to it lengthens (scaleY, moyen);
 * - a removed row stays as a ghost while it fades (0.7 × moyen), the next ones move up;
 * - a row whose place changes slides there on the "liaison" spring (FLIP, moyen), from where it
 *   is seen: the end of a drag, a keyboard move, a step that opens its settings…
 *
 * Measured only when `layoutKey` (the rows' keys, and whatever else moves them: the step whose
 * settings are open) or `frozen` changes, never at a mere render (review B3). Rows that change
 * size meanwhile (a field that wraps, the window's width) are measured again by a ResizeObserver,
 * without motion. Rows are the list's direct children with `data-row-key`. Inside a row,
 * `data-chain-point` is its point and `data-chain-seg` the thread to the next row. The list must
 * be positioned. While `frozen` (a drag shifts the rows itself) positions are only recorded.
 */
export function useListMotion(
  list: RefObject<HTMLElement | null>,
  state: ListMotionState,
  layoutKey: string,
  frozen = false,
): void {
  useLayoutEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const t = currentMotion();
    const reduced = prefersReducedMotion();
    const move = durOf(t, 2, "moyen", reduced);
    const { before, now } = state.next(ol);
    if (before && move > 0 && !frozen) {
      for (const [key, was] of before) if (!now.has(key)) leave(ol, was, t, reduced);
      for (const [key, row] of now) {
        const was = before.get(key);
        if (!was) {
          enter(row.el, t, reduced);
          continue;
        }
        const seenBefore = was.top + was.shift + row.flipping;
        const dy = seenBefore - (row.top + row.shift);
        if (Math.abs(dy) > 0.5) slide(row.el, dy, move, t.ease.move);
        if (row.seg && !was.seg) grow(row.seg, t, reduced);
        if (!row.seg && was.seg) shrink(row.el, was.seg, t, reduced);
      }
    }
  }, [list, state, layoutKey, frozen]);

  useEffect(() => {
    const ol = list.current;
    if (!ol || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(() => state.refresh(ol));
    ro.observe(ol);
    for (const row of ol.querySelectorAll(":scope > [data-row-key]")) ro.observe(row);
    return () => ro.disconnect();
  }, [list, state, layoutKey]);
}

/** Every row of the list: where it is laid out, its shift, and a slide in progress. */
function measureRows(ol: HTMLElement): Map<string, Row> {
  const rows = new Map<string, Row>();
  for (const el of ol.querySelectorAll<HTMLElement>(":scope > [data-row-key]")) {
    // Where it is seen right now: a slide in progress counts (it goes on from there).
    const flipping = translateOf(getComputedStyle(el).transform);
    rows.set(el.dataset.rowKey!, { el, ...measure(el), flipping });
  }
  return rows;
}

interface Row {
  el: HTMLElement;
  /** Layout position in the list (no transform). */
  top: number;
  height: number;
  width: number;
  left: number;
  /** `translate` it has now (a drag shift). */
  shift: number;
  /** translateY of a slide in progress (transform). */
  flipping: number;
  seg: HTMLElement | null;
}

function measure(el: HTMLElement) {
  return {
    top: el.offsetTop,
    left: el.offsetLeft,
    height: el.offsetHeight,
    width: el.offsetWidth,
    shift: shiftOf(getComputedStyle(el).translate),
    seg: el.querySelector<HTMLElement>(":scope [data-chain-seg]"),
  };
}

/** The y of a computed `transform` (matrix…) or 0. */
export function translateOf(transform: string): number {
  const m = /^matrix\(([^)]+)\)$/.exec(transform);
  if (m) return Number(m[1]!.split(",")[5]) || 0;
  const m3 = /^matrix3d\(([^)]+)\)$/.exec(transform);
  return m3 ? Number(m3[1]!.split(",")[13]) || 0 : 0;
}

/** The y of a computed `translate` ("none", "0px 12px", "4px"). */
export function shiftOf(translate: string): number {
  const parts = translate.split(" ");
  return parts.length > 1 ? parseFloat(parts[1]!) || 0 : 0;
}

const FLIP = "flip";

function slide(el: HTMLElement, dy: number, ms: number, easing: string): void {
  for (const a of el.getAnimations()) if (a.id === FLIP) a.cancel();
  const a = el.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0px)" }], {
    duration: ms,
    easing,
  });
  a.id = FLIP;
}

function enter(el: HTMLElement, t: ReturnType<typeof currentMotion>, reduced: boolean): void {
  el.animate(
    [
      { opacity: 0, translate: `0 ${t.rise}px` },
      { opacity: 1, translate: "0 0" },
    ],
    { duration: durOf(t, 2, "moyen", reduced), easing: t.ease.in, fill: "backwards" },
  );
  el.querySelector<HTMLElement>("[data-chain-point]")?.animate(
    [{ transform: `scale(${t.chain.pointFrom})` }, { transform: "scale(1)" }],
    {
      duration: durOf(t, 2, "court", reduced),
      delay: t.chain.pointDelay,
      easing: t.ease.move,
      fill: "backwards",
    },
  );
}

function grow(seg: HTMLElement, t: ReturnType<typeof currentMotion>, reduced: boolean): void {
  seg.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
    duration: durOf(t, 2, "moyen", reduced),
    easing: t.ease.in,
    fill: "backwards",
  });
}

/** A thread that goes away (its row became the last one) shortens instead of vanishing. */
function shrink(
  row: HTMLElement,
  seg: HTMLElement,
  t: ReturnType<typeof currentMotion>,
  reduced: boolean,
): void {
  row.append(seg);
  const a = seg.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], {
    duration: durOf(t, 2, "moyen", reduced, true),
    easing: t.ease.out,
    fill: "forwards",
  });
  a.onfinish = a.oncancel = () => seg.remove();
}

/** The removed row (detached by React) comes back as a ghost where it was, and fades. */
function leave(ol: HTMLElement, was: Row, t: ReturnType<typeof currentMotion>, reduced: boolean) {
  const ghost = was.el;
  for (const a of ghost.getAnimations()) a.cancel();
  ghost.removeAttribute("data-row-key");
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: "absolute",
    top: `${was.top + was.shift}px`,
    left: `${was.left}px`,
    width: `${was.width}px`,
    margin: "0",
    translate: "none",
    pointerEvents: "none",
  });
  ol.append(ghost);
  const a = ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: durOf(t, 2, "moyen", reduced, true),
    easing: t.ease.out,
    fill: "forwards",
  });
  a.onfinish = a.oncancel = () => ghost.remove();
}
