import { useEffect } from "react";
import type { Quality } from "../design";
import { cadenceFor, underDialog, type Cadence } from "./budget";

/**
 * What caps the cadence right now (step 13): the quality shown on <html> (`data-quality`, set by
 * the app) and the dialogs open over the scene. A counter, so nested dialogs and unmounts in any
 * order stay right; the engine reads it at each frame (a number, no event needed).
 */
let dialogs = 0;

/** A dialog (or the command palette) covers the scene until the returned function is called. */
export function holdDialogCap(): () => void {
  dialogs++;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    dialogs = Math.max(0, dialogs - 1);
  };
}

export function dialogOpen(): boolean {
  return dialogs > 0;
}

const QUALITIES: readonly Quality[] = ["eco", "balanced", "high", "ultra"];

/** The quality the page shows (`html[data-quality]`), High outside a page (tests). */
export function liveQuality(): Quality {
  const q = typeof document === "undefined" ? undefined : document.documentElement.dataset.quality;
  return QUALITIES.includes(q as Quality) ? (q as Quality) : "high";
}

/** Cadences of the live quality, dialog cap included. */
export function liveCadence(): Cadence {
  const c = cadenceFor(liveQuality());
  return dialogOpen() ? underDialog(c) : c;
}

/** Holds the dialog cap while `open` is true (Dialog, command palette). */
export function useDialogCap(open: boolean): void {
  useEffect(() => (open ? holdDialogCap() : undefined), [open]);
}

/** Tests only. */
export function resetDialogCap(): void {
  dialogs = 0;
}
