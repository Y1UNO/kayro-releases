import { mountedRange } from "./carouselGeometry";

/**
 * React keys of the carousel cards (art direction round 3b). Inside a category a card keeps its
 * key (it slides). When the list changes (tab change), a new app takes the key of the old app that
 * was at the same place: React updates the same five cards instead of unmounting and mounting
 * them (the deck gathers and unfolds the same elements; measured round 3: a new category's
 * commit cost 11–17 ms in a dev build). Pure, tested.
 */
export interface KeyState {
  /** Key of each mounted app, by app id. */
  keys: ReadonlyMap<string, string>;
  ids: readonly string[];
  focus: number;
  /** Next fresh key number. */
  next: number;
}

export function inheritKeys(
  prev: KeyState | null,
  ids: readonly string[],
  focus: number,
): KeyState {
  const [from, to] = mountedRange(focus, ids.length);
  const mounted = ids.slice(from, Math.max(from, to + 1));
  const now = new Set(mounted);
  const keys = new Map<string, string>();
  const taken = new Set<string>();
  let next = prev?.next ?? 0;
  // Apps already on screen keep their key.
  for (const id of mounted) {
    const k = prev?.keys.get(id);
    if (k !== undefined) {
      keys.set(id, k);
      taken.add(k);
    }
  }
  for (let i = from; i <= to; i++) {
    const id = ids[i]!;
    if (keys.has(id)) continue;
    // The old app at the same distance from the selection, if it leaves the screen.
    const old = prev ? prev.ids[prev.focus + (i - focus)] : undefined;
    const k = old !== undefined && !now.has(old) ? prev!.keys.get(old) : undefined;
    if (k !== undefined && !taken.has(k)) {
      keys.set(id, k);
      taken.add(k);
    } else {
      const fresh = `k${next++}`;
      keys.set(id, fresh);
      taken.add(fresh);
    }
  }
  return { keys, ids, focus, next };
}
