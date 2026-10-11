import type { AppEntry } from "../../ipc/bindings";

/**
 * URL of an app's poster, or null when there is none (the card then shows a monogram).
 *
 * Posters live under `cache/art/` in the data folder (`art.poster` is relative to it). The webview
 * cannot read that folder yet: the cache is filled and the file protocol (with a minimal scope and
 * CSP) is opened in step 9, when apps are added with their art. Until then `art.poster` is always
 * empty for real data, and this stays the single place to change.
 */
export function posterUrl(app: Pick<AppEntry, "art"> & { id?: string }): string | null {
  void app.art.poster;
  if (!import.meta.env.DEV || devPosters.length === 0) return null;
  // Several stand-ins, spread over the cards (tests the engine's poster textures, round 2b).
  let h = 0;
  for (const c of app.id ?? "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return devPosters[h % devPosters.length]!;
}

/** Dev pages only (`/dev/home?posters=1`): stand-in posters, spread over the cards. */
let devPosters: readonly string[] = [];
export function setDevPoster(urls: readonly string[] | null): void {
  if (import.meta.env.DEV) devPosters = urls ?? [];
}
