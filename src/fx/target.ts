import { useEffect, type DependencyList } from "react";
import type { FxLayer, FxTarget } from "./FxLayer";

/**
 * Who the light falls on. Several screens may claim the target in turn (a cross-fade mounts the
 * new view before the old one leaves): only the latest claimant may clear it.
 */
let fx: FxLayer | null = null;
let owner: object | null = null;
let last: FxTarget | null = null;

/** Called by <Atmosphere /> (null when it unmounts). */
export function connectFx(layer: FxLayer | null): void {
  fx = layer;
  fx?.setFocusTarget(last);
}

function claim(token: object, target: FxTarget | null): void {
  owner = token;
  last = target;
  fx?.setFocusTarget(target);
}

function release(token: object): void {
  if (owner !== token) return;
  owner = null;
  last = null;
  fx?.setFocusTarget(null);
}

/** Re-measure once the entering view has settled (spring of the screen transition). */
const SETTLE_MS = 700;

/**
 * Points the light at what `measure` returns (viewport px). Measured when `deps` change, on
 * resize, on scroll, and once more after the view's entrance animation.
 */
export function useFxTarget(measure: () => FxTarget | null, deps: DependencyList): void {
  useEffect(() => {
    const token = {};
    const update = () => claim(token, measure());
    update();
    const settle = window.setTimeout(update, SETTLE_MS);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, { capture: true, passive: true });
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, { capture: true });
      release(token);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Target for an element: its horizontal centre, its top and bottom edges. */
export function targetOf(el: Element | null | undefined, height?: number): FxTarget | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, top: r.top, bottom: r.top + (height ?? r.height) };
}
