import { useSyncExternalStore } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "./motionPref";

/**
 * "Reduce motion" (the Windows setting, unless « Suivre Windows » is off), followed live: a
 * component that reads it here renders again when it changes, instead of keeping the value it had
 * at mount (review B7).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(onReducedMotionChange, prefersReducedMotion, () => false);
}
