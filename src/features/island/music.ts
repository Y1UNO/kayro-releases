/**
 * Step 20 (Kysland): small pure helpers for the music the island shows, and what the island
 * adds at rest (islandShape.ts `shapeOf`). Tested.
 */
import type { NowPlaying } from "../../ipc/bindings";

/** What the island adds at rest: music (cover and bars), a launch (logo and name), dots. */
export const REST_GROW = { media: 44, stretch: 130, dots: 26 } as const;

/** Where the track is now (0–1) and how long until it ends (ms), moved on while it plays. */
export function progressAt(np: NowPlaying, nowMs: number): { pct: number; remainingMs: number } {
  const duration = np.durationMs ?? 0;
  if (duration <= 0) return { pct: 0, remainingMs: 0 };
  const at = np.atMs ?? 0;
  const since = np.playing && at > 0 ? Math.max(0, nowMs - at) : 0;
  const position = Math.min(duration, Math.max(0, (np.positionMs ?? 0) + since));
  return { pct: position / duration, remainingMs: duration - position };
}

/** `#rrggbb` → « r g b » (for `rgb(var(--x) / a)`), null when it is not a colour. */
export function rgbOf(hex: string | undefined | null): string | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  if (!m) return null;
  return [m[1], m[2], m[3]].map((h) => parseInt(h ?? "0", 16)).join(" ");
}

/** A track's identity (its cover changes with it). */
export function trackKey(np: NowPlaying | null): string {
  return np ? `${np.title}\u001f${np.artist}\u001f${np.player}` : "";
}
