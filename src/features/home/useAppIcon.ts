import { useEffect, useState } from "react";
import type { AppEntry, AppSource } from "../../ipc/bindings";
import { ipc } from "../../ipc/commands";
import { useArtUrl } from "./art";

/** Remembers each answer for the session (a missing icon too): one request per app and target. */
const cache = new Map<string, Promise<string | null>>();
/** The answers already in: read while rendering (step 13: a tab change shows them at once, with no
 * second render of each card in the click). */
const known = new Map<string, string | null>();

type IconApp = Pick<AppEntry, "id" | "launch"> & { source?: AppSource };

/**
 * Programs and shortcuts have a Shell icon, and so do packaged apps and Epic games (through the
 * program their manifest names, step 14). A not-yet-saved app (optimistic id) has none yet.
 */
function iconKey(app: IconApp): string | null {
  if (app.id.startsWith("pending-")) return null;
  const { launch } = app;
  if (launch.kind === "exe" || launch.kind === "lnk") return `${app.id}|${launch.path}`;
  if (launch.kind === "uwp") return `${app.id}|${launch.aumid}`;
  if (launch.kind === "uri" && app.source?.kind === "epic")
    return `${app.id}|${app.source.appName}`;
  return null;
}

function load(id: string, key: string): Promise<string | null> {
  let found = cache.get(key);
  if (!found) {
    found = ipc.appIcon(id).then((r) => {
      const url = r.ok ? r.value : null;
      known.set(key, url);
      return url;
    });
    cache.set(key, found);
  }
  return found;
}

/**
 * The app's icon as a `data:` URL, or null while it loads or when it has none (the card then keeps
 * its monogram). The extraction and the resizing happen in the core, off the interface thread.
 * Steam games have no Shell icon: Steam's own small one is used instead (`kayro-art`).
 */
export function useAppIcon(app: IconApp): string | null {
  const shell = useShellIcon(app);
  const steam = useArtUrl(app.id, "icon");
  return shell ?? steam;
}

function useShellIcon(app: IconApp): string | null {
  const key = iconKey(app);
  const id = app.id;
  const [loaded, setLoaded] = useState<{ key: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!key || known.has(key)) return;
    let live = true;
    void load(id, key).then((url) => {
      if (live) setLoaded({ key, url });
    });
    return () => {
      live = false;
    };
  }, [id, key]);

  if (!key) return null;
  if (known.has(key)) return known.get(key) ?? null;
  return loaded?.key === key ? loaded.url : null;
}
