import { useSyncExternalStore } from "react";
import { prefersReducedMotion } from "./motionPref";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const mq = matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * "Reduce motion" (the Windows setting), followed live: a component that reads it here renders
 * again when it changes, instead of keeping the value it had at mount (review B7).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
