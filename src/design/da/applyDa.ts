import { daStore } from "./daStore";
import { daVariables } from "./values";

let applied: string[] = [];

/** Writes the CSS variables of the art direction on <html>; removes those no longer set. */
export function applyDa(vars: Record<string, string>): void {
  const s = document.documentElement.style;
  for (const name of applied) if (!(name in vars)) s.removeProperty(name);
  for (const [name, value] of Object.entries(vars)) s.setProperty(name, value);
  applied = Object.keys(vars);
}

let installed = false;

/** Applies the current direction now and after every change (the user's settings, userDa.ts). */
export function installDa(): void {
  if (installed) return;
  installed = true;
  applyDa(daVariables(daStore.getState().values));
  daStore.subscribe((s, prev) => {
    if (s.values !== prev.values) applyDa(daVariables(s.values));
  });
}
