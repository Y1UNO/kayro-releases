/**
 * « Réduire les animations » as Kayro applies it: the Windows setting (`prefers-reduced-motion`),
 * unless the user turned « Suivre Windows » off in Réglages › Visuel (round 5). One source for the
 * scripts (here) and the stylesheets (`data-rm-ignore` on <html> guards their media queries).
 */
const QUERY = "(prefers-reduced-motion: reduce)";

let followSystem = true;
const listeners = new Set<() => void>();

/** One query object, kept: `matchMedia()` costs ~0.5 ms a call (step 13, in the click of a link). */
let query: MediaQueryList | null | undefined;
function systemQuery(): MediaQueryList | null {
  if (query === undefined) query = typeof matchMedia === "function" ? matchMedia(QUERY) : null;
  return query;
}

function systemReduced(): boolean {
  return systemQuery()?.matches ?? false;
}

/** True when motion must be reduced (false where matchMedia does not exist, e.g. in tests). */
export function prefersReducedMotion(): boolean {
  return followSystem && systemReduced();
}

/** « Suivre Windows » (default on). Off: Kayro animates whatever Windows says. */
export function setFollowSystemMotion(follow: boolean): void {
  if (follow === followSystem) return;
  followSystem = follow;
  if (typeof document !== "undefined") {
    if (follow) delete document.documentElement.dataset.rmIgnore;
    else document.documentElement.dataset.rmIgnore = "";
  }
  for (const l of listeners) l();
}

/** Called when the answer of `prefersReducedMotion()` may have changed (Windows or the setting). */
export function onReducedMotionChange(onChange: () => void): () => void {
  listeners.add(onChange);
  const mq = systemQuery();
  mq?.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    mq?.removeEventListener("change", onChange);
  };
}
