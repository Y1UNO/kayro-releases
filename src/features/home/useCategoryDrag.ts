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
  /** Step 19b: another card under the pointer, and on which side of it the app would go. */
  near: { id: string; after: boolean } | null;
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

/** Another card under a point (not `self`), and whether the point is on its right half. */
function cardAt(x: number, y: number, self: string): { id: string; after: boolean } | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const card = el instanceof HTMLElement ? el.closest<HTMLElement>("[data-app-id]") : null;
    const id = card?.dataset.appId;
    if (!card || !id) continue;
    if (id === self) return null;
    const r = card.getBoundingClientRect();
    return { id, after: x > r.left + r.width / 2 };
  }
  return null;
}

/** The insertion mark on the card the app would land next to (`data-drop-side`, CSS). */
function markNear(near: { id: string; after: boolean } | null) {
  for (const el of document.querySelectorAll<HTMLElement>("[data-drop-side]")) {
    if (el.dataset.appId !== near?.id) delete el.dataset.dropSide;
  }
  if (!near) return;
  const card = document.querySelector<HTMLElement>(`[data-app-id="${CSS.escape(near.id)}"]`);
  if (card) card.dataset.dropSide = near.after ? "after" : "before";
}

/**
 * Drag a card onto a category tab to change its category, or next to another card to put it
 * there (step 19b). Done with pointer events: the window's
 * file-drop handling (needed for the "add apps" dialog) turns HTML5 drag-and-drop off on Windows.
 * Listeners exist only while a button is held.
 */
export function useCategoryDrag(
  find: (id: string) => AppEntry | undefined,
  onDrop: (app: AppEntry, category: CategoryId) => void,
  onPlace: (app: AppEntry, target: string, after: boolean) => void,
) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const latest = useRef({ find, onDrop, onPlace });
  useEffect(() => {
    latest.current = { find, onDrop, onPlace };
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
    const frame = new PointerFrame<number>((_k, _el, x, y) => {
      const over = categoryAt(x, y);
      const near = over ? null : cardAt(x, y, app.id);
      markNear(near);
      setDrag({ app, x, y, over, near });
    });

    const stop = () => {
      frame.dispose();
      markNear(null);
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
      const near = over ? null : cardAt(ev.clientX, ev.clientY, app.id);
      setDrag(null);
      if (over && over !== app.category) latest.current.onDrop(app, over);
      else if (near) latest.current.onPlace(app, near.id, near.after);
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
