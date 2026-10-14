import { useEffect, useLayoutEffect, useRef } from "react";
import { AMBIENT_FPS } from "../../fx/budget";
import { frameLoop } from "../../fx/loop";

/**
 * A small endless motion (a loading thread that glides, a card that floats: round 4b) on the
 * app's single frame loop, at the ambient rate (60 i/s, on the same frames as the atmosphere),
 * only while `active`. Never an infinite CSS animation: those make the compositor draw at the
 * screen's full rate (17 % of a core measured at step 8). The loop pauses with the window.
 */
export function useAmbientLoop(active: boolean, tick: (now: number) => void): void {
  const latest = useRef(tick);
  useLayoutEffect(() => {
    latest.current = tick;
  });
  useEffect(() => {
    if (!active) return;
    return frameLoop().subscribe((_dt, now) => latest.current(now), AMBIENT_FPS);
  }, [active]);
}
