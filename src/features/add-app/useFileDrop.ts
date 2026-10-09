import { useEffect, useRef, useState } from "react";

/** True inside the Tauri window; false in a plain browser (dev pages, tests). */
function insideTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface FileDrop {
  /** Files are being dragged over the window. */
  hovering: boolean;
  /** Dropping files works here (it needs the Tauri window). */
  available: boolean;
}

/**
 * Files dropped on the window, through Tauri's drag-and-drop event (the webview itself never sees
 * the files). Paths only: nothing is read or started here.
 */
export function useFileDrop(onPaths: (paths: string[]) => void): FileDrop {
  const [hovering, setHovering] = useState(false);
  const handler = useRef(onPaths);
  const available = insideTauri();
  useEffect(() => {
    handler.current = onPaths;
  });

  useEffect(() => {
    if (!insideTauri()) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((event) => {
          const { type } = event.payload;
          if (type === "enter" || type === "over") setHovering(true);
          else setHovering(false);
          if (event.payload.type === "drop") handler.current(event.payload.paths);
        }),
      )
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch(() => {
        // No permission or no webview: the paste field still works.
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return { hovering, available };
}
