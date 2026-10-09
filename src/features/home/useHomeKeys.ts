import { useEffect, useRef } from "react";

export interface HomeKeyHandlers {
  /** Arrow keys: dx = -1 / 1 (left / right), dy = -1 / 1 (up / down). */
  onArrow: (dx: number, dy: number) => void;
  onEdge: (edge: "first" | "last") => void;
  onCategoryStep: (delta: 1 | -1) => void;
  /** Enter with nothing focused: launch the selected app. */
  onEnter: () => void;
  onEscape: () => void;
  onSearch: () => void;
  /** F2: edit the selected app. */
  onEdit: () => void;
  /** Context-menu key or Shift+F10: menu of the selected app. */
  onMenu: () => void;
}

/**
 * Keyboard of the home screen, as one window listener (no per-card listener).
 * Keys typed in a field, inside a control that handles its own arrows (`data-own-keys`: the tabs)
 * or while a modal is open (`#root` is inert) are left alone. Enter is only taken when no button
 * has the focus (nothing focused, or the card list itself): on a focused button the browser's own
 * Enter / click already does the job.
 */
export function useHomeKeys(handlers: HomeKeyHandlers, enabled: boolean): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (document.getElementById("root")?.hasAttribute("inert")) return;
      const h = latest.current;

      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        const inField = e.target instanceof Element && e.target.closest("input, textarea, select");
        if (inField) return;
        e.preventDefault();
        h.onMenu();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        h.onSearch();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable], [data-own-keys]")) return;

      switch (e.key) {
        case "ArrowLeft":
          h.onArrow(-1, 0);
          break;
        case "ArrowRight":
          h.onArrow(1, 0);
          break;
        case "ArrowUp":
          h.onArrow(0, -1);
          break;
        case "ArrowDown":
          h.onArrow(0, 1);
          break;
        case "Home":
          h.onEdge("first");
          break;
        case "End":
          h.onEdge("last");
          break;
        case "PageUp":
          h.onCategoryStep(-1);
          break;
        case "PageDown":
          h.onCategoryStep(1);
          break;
        case "Enter":
          if (target?.closest("button, a, summary")) return; // its own Enter / click does the job
          h.onEnter();
          break;
        case "Escape":
          h.onEscape();
          break;
        case "F2":
          h.onEdit();
          break;
        default:
          return;
      }
      e.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
