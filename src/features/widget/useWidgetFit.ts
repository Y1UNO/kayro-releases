import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { desktopIpc } from "../../ipc/commands";

/**
 * Keeps the (transparent) widget window the size of its content: whenever the element's size
 * changes, the core is asked to resize the window, keeping its centre and its top edge.
 * `fitNow` does it once at once and resolves when the window has its size (used before the
 * first reveal).
 */
export function useWidgetFit(ref: RefObject<HTMLElement | null>): { fitNow: () => Promise<void> } {
  const last = useRef("");

  const send = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const w = Math.ceil(width);
    const h = Math.ceil(height);
    const key = `${w}x${h}`;
    if (w < 1 || h < 1 || key === last.current) return;
    last.current = key;
    await desktopIpc.fitWidget(w, h);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => void send());
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref, send]);

  return { fitNow: send };
}
