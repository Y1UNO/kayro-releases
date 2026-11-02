import { createStore, useStore } from "zustand";
import type { ThemeFile } from "../../ipc/bindings";
import { themesIpc } from "../../ipc/commands";
import { onThemesChanged } from "../../ipc/events";
import { parseTheme, type Theme } from "../theme";

/**
 * The personal themes (step 15), read from the core (`themes/perso-*.json`). Each is checked again
 * here like any untrusted file; a theme that does not pass is left out. Both windows keep their
 * own copy, updated by the core's `themes-changed` event.
 */
export const PERSONAL_PREFIX = "perso-";

export const customThemes = createStore<{ list: readonly Theme[] }>(() => ({ list: [] }));

export function setCustomThemes(files: readonly unknown[]): void {
  const list: Theme[] = [];
  for (const f of files) {
    const r = parseTheme(f);
    if (r.ok && r.theme.id.startsWith(PERSONAL_PREFIX)) list.push(r.theme);
  }
  customThemes.setState({ list });
}

/** The personal theme with this id, if any. */
export const personalTheme = (id: string): Theme | undefined =>
  customThemes.getState().list.find((t) => t.id === id);

export function useCustomThemes(): readonly Theme[] {
  return useStore(customThemes, (s) => s.list);
}

let started = false;

/** Reads the personal themes and follows their changes (a few ms, local: before the first paint). */
export async function loadCustomThemes(): Promise<void> {
  if (started) return;
  started = true;
  await onThemesChanged((files: ThemeFile[]) => setCustomThemes(files));
  const r = await themesIpc.list();
  if (r.ok) setCustomThemes(r.value);
}
