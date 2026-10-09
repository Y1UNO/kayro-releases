/** `prefers-reduced-motion: reduce` (false where matchMedia does not exist, e.g. in tests). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
