import { useEffect } from "react";

/**
 * Depth under a dialog (step 24, paquet 3): while a dialog or the command palette is open, the
 * screens step back (`html[data-depth]`, App.module.css), the sky stays: the attention goes to the
 * dialog, and comes back to the scene when it closes. A counter, like the dialog cap (cadenceCap.ts):
 * nested dialogs and unmounts in any order stay right. The launch « Sceau » does not use it.
 */
let open = 0;

function sync(): void {
  if (typeof document === "undefined") return;
  if (open > 0) document.documentElement.dataset.depth = "";
  else delete document.documentElement.dataset.depth;
}

export function holdSceneDepth(): () => void {
  open++;
  sync();
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    open = Math.max(0, open - 1);
    sync();
  };
}

/** Holds the depth while `on` is true (Dialog, command palette). */
export function useSceneDepth(on: boolean): void {
  useEffect(() => (on ? holdSceneDepth() : undefined), [on]);
}
