import { useEffect, useState } from "react";
import type { DetectedApp } from "../../ipc/bindings";
import { detect } from "../../ipc/commands";
import type { Item } from "./items";

/** One request per app for the session (a missing icon too). */
const cache = new Map<string, Promise<string | null>>();
const known = new Map<string, string | null>();

/** 12 hex characters of `text` (FNV-1a), for an id the core can use in a file name. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** What the core needs to find the icon: the scan's own entry, or one made for a dropped file. */
function asDetected(item: Item): DetectedApp {
  return (
    item.detected ?? {
      id: `drop-${hash(item.key)}`,
      name: item.name,
      source: item.source,
      launch: item.launch,
      match: item.match,
      posterPath: null,
      heroPath: null,
      alreadyAdded: false,
      suggestedCategory: "",
      launcher: false,
      ignored: false,
    }
  );
}

/**
 * The proposed app's own logo (19b) as a `data:` URL, or null while it loads or when it has none
 * (the row keeps its monogram). Extracted in the core, off the interface thread.
 */
export function useItemIcon(item: Item): string | null {
  const app = asDetected(item);
  const id = app.id;
  const [url, setUrl] = useState<string | null>(() => known.get(id) ?? null);

  useEffect(() => {
    if (known.has(id)) return;
    let live = true;
    let found = cache.get(id);
    if (!found) {
      found = detect.icon(app).then((r) => {
        const value = r.ok ? r.value : null;
        known.set(id, value);
        return value;
      });
      cache.set(id, found);
    }
    void found.then((value) => live && setUrl(value));
    return () => {
      live = false;
    };
    // `app` is rebuilt at each render; its id names it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return known.get(id) ?? url;
}
