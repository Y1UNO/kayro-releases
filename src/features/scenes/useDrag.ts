import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

/**
 * Drag and drop with pointer events. HTML5 drag and drop is turned off by Tauri's file-drop
 * handler on Windows (see the add-apps step), so this works on its own.
 */
export interface DragState<P> {
  payload: P;
  x: number;
  y: number;
  /** Insertion position among the rows of the list (0…rows), null when the pointer is outside it. */
  index: number | null;
}

interface Options<P> {
  list: RefObject<HTMLElement | null>;
  /** CSS selector of the rows inside `list`. */
  rows: string;
  onDrop: (payload: P, index: number | null) => void;
  /** The drag ends (dropped or cancelled), before the drop changes anything: the rows still show
   *  the drag's shifts (useListMotion's `snapshot`). */
  onEnd?: () => void;
}

const THRESHOLD = 5;
const MARGIN = 24;

/** Where a pointer at (`x`, `y`) would insert, among rows given by their vertical middles. */
export function insertionIndex(
  rect: { left: number; right: number; top: number; bottom: number },
  middles: readonly number[],
  x: number,
  y: number,
): number | null {
  const inside =
    x >= rect.left - MARGIN &&
    x <= rect.right + MARGIN &&
    y >= rect.top - MARGIN &&
    y <= rect.bottom + MARGIN;
  if (!inside) return null;
  return middles.filter((m) => m < y).length;
}

export function useDrag<P>({ list, rows, onDrop, onEnd }: Options<P>) {
  const [drag, setDrag] = useState<DragState<P> | null>(null);
  const clickBlocked = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  const drop = useRef(onDrop);
  const ending = useRef(onEnd);
  useEffect(() => {
    drop.current = onDrop;
    ending.current = onEnd;
  });
  useEffect(() => () => stop.current?.(), []);

  const indexAt = useCallback(
    (x: number, y: number) => {
      const el = list.current;
      if (!el) return null;
      const middles = Array.from(el.querySelectorAll<HTMLElement>(rows)).map((r) => {
        const b = r.getBoundingClientRect();
        return b.top + b.height / 2;
      });
      return insertionIndex(el.getBoundingClientRect(), middles, x, y);
    },
    [list, rows],
  );

  const begin = useCallback(
    (e: ReactPointerEvent, payload: P) => {
      if (e.button !== 0 || stop.current) return;
      const startX = e.clientX;
      const startY = e.clientY;
      let active = false;

      const move = (ev: PointerEvent) => {
        if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
        active = true;
        document.body.style.userSelect = "none";
        setDrag({
          payload,
          x: ev.clientX,
          y: ev.clientY,
          index: indexAt(ev.clientX, ev.clientY),
        });
      };
      const end = (ev: PointerEvent | null) => {
        ending.current?.();
        cleanup();
        if (active) {
          clickBlocked.current = true;
          window.setTimeout(() => (clickBlocked.current = false), 0);
          if (ev) drop.current(payload, indexAt(ev.clientX, ev.clientY));
        }
        setDrag(null);
      };
      const up = (ev: PointerEvent) => end(ev);
      const cancel = () => end(null);
      const key = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ev.stopPropagation();
          cancel();
        }
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", key, true);
        document.body.style.userSelect = "";
        stop.current = null;
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("keydown", key, true);
      stop.current = cleanup;
    },
    [indexAt],
  );

  /** True right after a drag ended: the click that follows must not also act. */
  const ignoreClick = useCallback(() => clickBlocked.current, []);

  return { drag, begin, ignoreClick };
}
