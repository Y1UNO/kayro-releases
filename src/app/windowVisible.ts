import { useSyncExternalStore } from "react";
import { onWindowVisibility } from "../ipc/events";

let visible = true;
const subscribers = new Set<() => void>();
let stop: (() => void) | null = null;

function set(v: boolean): void {
  if (v === visible) return;
  visible = v;
  for (const notify of subscribers) notify();
}

/** One listener for the whole page, while something follows it. */
function start(): () => void {
  const onDocument = () => set(!document.hidden);
  document.addEventListener("visibilitychange", onDocument);
  // WebView2 never fires `visibilitychange` for a window the core hides (spike 01): the core
  // says so itself.
  const off = onWindowVisibility(({ visible: shown }) => set(shown));
  return () => {
    document.removeEventListener("visibilitychange", onDocument);
    void off.then((unlisten) => unlisten());
  };
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  stop ??= start();
  return () => {
    subscribers.delete(notify);
    if (subscribers.size > 0) return;
    stop?.();
    stop = null;
  };
}

/**
 * The window is on screen. A small periodic effect (a light that crosses a card or a rule from
 * time to time) stops its timer while it is false (review B2): no timer runs for a hidden hub.
 */
/** Outside React (the sounds, step 17b): told each time the window shows or hides. */
export function followWindowVisible(onChange: (visible: boolean) => void): () => void {
  return subscribe(() => onChange(visible));
}

export function useWindowVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => visible,
    () => true,
  );
}
