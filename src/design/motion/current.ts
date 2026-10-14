import { useMemo } from "react";
import { daStore, useDa } from "../da/daStore";
import { motionTokens, type MotionTokens } from "./tokens";

/** The motion token table as tuned now (art direction `motion`), for script that runs once. */
export function currentMotion(): MotionTokens {
  return motionTokens(daStore.getState().values.motion);
}

/** The motion token table, live (re-renders when a setting changes it). */
export function useMotionTokens(): MotionTokens {
  const v = useDa((s) => s.values.motion);
  return useMemo(() => motionTokens(v), [v]);
}
