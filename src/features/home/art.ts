import type { AppEntry } from "../../ipc/bindings";

/**
 * URL of an app's poster, or null when there is none (the card then shows a monogram).
 *
 * Posters live under `cache/art/` in the data folder (`art.poster` is relative to it). The webview
 * cannot read that folder yet: the cache is filled and the file protocol (with a minimal scope and
 * CSP) is opened in step 9, when apps are added with their art. Until then `art.poster` is always
 * empty for real data, and this stays the single place to change.
 */
export function posterUrl(app: Pick<AppEntry, "art">): string | null {
  void app.art.poster;
  return null;
}
