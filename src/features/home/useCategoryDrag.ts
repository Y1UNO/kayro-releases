import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { PointerFrame } from "../../fx/pointerFrame";
import type { AppEntry } from "../../ipc/bindings";
import { CATEGORY_IDS, type CategoryId } from "./categories";

export interface DragState {
  app: AppEntry;
  x: number;
  y: number;
  /** The category tab under the pointer, if any. */
  over: CategoryId | null;
}

/** Movement below this is a click, not a drag. */
const THRESHOLD = 8;

/** The tab under a point: tabs carry `data-drop-category`. */
function categoryAt(x: number, y: number): CategoryId | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const id = el instanceof HTMLElement ? el.dataset.dropCategory : undefined;
    const found = CATEGORY_IDS.find((c) => c === id);
    if (found) return found;
  }
  return null;
}

/**
 * Drag a card onto a category tab to change its category. Done with pointer events: the window's
 * file-drop handling (needed for the "add apps" dialog) turns HTML5 drag-and-drop off on Windows.
 * Listeners exist only while a button is held.
 */
export function useCategoryDrag(
  find: (id: string) => AppEntry | undefined,
  onDrop: (app: AppEntry, category: CategoryId) => void,
) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const latest = useRef({ find, onDrop });
  useEffect(() => {
    latest.current = { find, onDrop };
  });

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0 || !(e.target instanceof Element)) return;
    if (e.target.closest("[data-edit-app]")) return;
    const id = e.target.closest<HTMLElement>("[data-app-id]")?.dataset.appId;
    const app = id ? latest.current.find(id) : undefined;
    if (!app) return;

    const start = { x: e.clientX, y: e.clientY };
    let active = false;
    // Once per frame whatever the mouse sends (step 13).
    const frame = new PointerFrame<number>((_k, _el, x, y) =>
      setDrag({ app, x, y, over: categoryAt(x, y) }),
    );

    const stop = () => {
      frame.dispose();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
    };
    const move = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < THRESHOLD) return;
      active = true;
      frame.push(0, document.body, ev.clientX, ev.clientY);
    };
    const up = (ev: PointerEvent) => {
      stop();
      if (!active) return;
      // The click that follows a drag must not launch the app.
      const swallow = (c: Event) => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, true), 60);
      const over = categoryAt(ev.clientX, ev.clientY);
      setDrag(null);
      if (over && over !== app.category) latest.current.onDrop(app, over);
    };
    const cancel = () => {
      stop();
      setDrag(null);
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.stopPropagation();
      cancel();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
  }, []);

  return { drag, onPointerDown };
}
