/**
 * « Réduire les animations » as Kayro applies it: the Windows setting (`prefers-reduced-motion`),
 * unless the user turned « Suivre Windows » off in Réglages › Visuel (round 5). One source for the
 * scripts (here) and the stylesheets (`data-rm-ignore` on <html> guards their media queries).
 */
const QUERY = "(prefers-reduced-motion: reduce)";

let followSystem = true;
const listeners = new Set<() => void>();

function systemReduced(): boolean {
  return typeof matchMedia === "function" && matchMedia(QUERY).matches;
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
  const mq = typeof matchMedia === "function" ? matchMedia(QUERY) : null;
  mq?.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    mq?.removeEventListener("change", onChange);
  };
}
