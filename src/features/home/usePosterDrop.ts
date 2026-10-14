import { useEffect } from "react";
import { artIpc } from "../../ipc/commands";
import { hubStore } from "../../store";

const IMAGE = /\.(jpe?g|png|webp)$/i;

/** True inside the Tauri window; false in a plain browser (dev pages, tests). */
function insideTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** The app whose card is under a drop point given in physical pixels of the window. */
function appAt(x: number, y: number): string | null {
  const ratio = window.devicePixelRatio || 1;
  const card = document
    .elementFromPoint(x / ratio, y / ratio)
    ?.closest<HTMLElement>("[data-app-id]");
  const id = card?.dataset.appId;
  return id && !id.startsWith("pending-") ? id : null;
}

async function takePoster(id: string, path: string): Promise<void> {
  const r = await artIpc.setUser(id, "poster", path);
  // The card changes through the index event; a refusal is said in the home message.
  if (!r.ok) hubStore.setState({ lastError: { ...r.error, field: "artImage" }, failedApp: null });
}

/**
 * Step 14: one image dropped on a card becomes that app's poster (copied into the data folder by
 * the core, which checks it). Ignored while a dialog is open (adding apps, importing a scene have
 * their own drop zones) and for anything else than one image on one card.
 */
export function usePosterDrop(): void {
  useEffect(() => {
    if (!insideTauri()) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((event) => {
          const p = event.payload;
          if (p.type !== "drop" || document.querySelector('[role="dialog"]')) return;
          const [path] = p.paths;
          if (p.paths.length !== 1 || !path || !IMAGE.test(path)) return;
          const id = appAt(p.position.x, p.position.y);
          if (id) void takePoster(id, path);
        }),
      )
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch(() => {
        // No permission or no webview: posters can still come from Steam.
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
}
