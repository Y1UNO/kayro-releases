import { useEffect, useState } from "react";

export type Presence = "in" | "out" | null;

/**
 * Keeps something on screen for its exit animation (art direction round 4a: a panel closes in
 * 0.7 × its opening time). "in" while `open`; "out" for `exitMs` after it closes (then null); a
 * new opening during the exit takes it back at once. `exitMs` 0 (level off, reduce motion) = gone
 * at once. Derived during render, one timer only while leaving.
 */
export function usePresence(open: boolean, exitMs: number): Presence {
  const [state, setState] = useState<Presence>(open ? "in" : null);
  let now = state;
  if (open && state !== "in") now = "in";
  else if (!open && state === "in") now = exitMs > 0 ? "out" : null;
  if (now !== state) setState(now);

  useEffect(() => {
    if (now !== "out") return;
    const id = window.setTimeout(() => setState((s) => (s === "out" ? null : s)), exitMs);
    return () => window.clearTimeout(id);
  }, [now, exitMs]);

  return now;
}
