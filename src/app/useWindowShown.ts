import { useEffect, useRef } from "react";
import { desktopIpc, ipc } from "../ipc/commands";
import { onWindowVisibility } from "../ipc/events";

/** Two painted frames from now, tell the core (a measurement is waiting for it). */
function reportPainted() {
  requestAnimationFrame(() => requestAnimationFrame(() => void desktopIpc.painted()));
}

/**
 * Tells the core the page has painted, so it can show the window (it stays hidden until then).
 * A window built for a shortcut that is being timed also reports its own paint.
 */
export async function announceReady(): Promise<void> {
  const result = await ipc.appReady();
  if (result.ok && result.value) reportPainted();
}

/**
 * Calls `onShown` each time the core shows this window. When a measurement is running the core
 * asks for a report: two frames after the show, the page says it painted.
 */
export function useWindowShown(onShown?: () => void): void {
  const latest = useRef(onShown);
  useEffect(() => {
    latest.current = onShown;
  });
  useEffect(() => {
    const unlisten = onWindowVisibility(({ visible, bench }) => {
      if (!visible) return;
      latest.current?.();
      if (bench) reportPainted();
    });
    return () => void unlisten.then((off) => off());
  }, []);
}
