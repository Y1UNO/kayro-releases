import { createStore, useStore } from "zustand";
import type { DisplayMode } from "../../ipc/bindings";
import { onWindowVisibility } from "../../ipc/events";
import { hubStore, useHub } from "../../store";

/**
 * Step 19: the express start's window is immersive whatever the user's mode (the core does the
 * same, `desktop/express.rs`), until it is first hidden or the mode is changed.
 */
const express = createStore<{ on: boolean }>(() => ({ on: false }));

/** Called once, when the page learns it is the express start. */
export function startExpressMode(): void {
  if (express.getState().on) return;
  express.setState({ on: true });
  const end = () => {
    express.setState({ on: false });
    stopSettings();
    void unlisten.then((off) => off());
  };
  const unlisten = onWindowVisibility(({ visible }) => !visible && end());
  const stopSettings = hubStore.subscribe((s, before) => {
    if (s.settings?.displayMode !== before.settings?.displayMode) end();
  });
}

/** The mode the page is shown in: immersive during the express start, else the setting. */
export function useDisplayMode(): DisplayMode {
  const setting = useHub((s) => s.settings?.displayMode ?? "immersive");
  return useStore(express, (s) => s.on) ? "immersive" : setting;
}

/**
 * Picks a display mode from the page. During the express start the window is immersive while the
 * setting may already say `mode`: the setting goes through immersive so that the core sees a change.
 */
export async function chooseDisplayMode(mode: DisplayMode): Promise<void> {
  const { settings, setSettings } = hubStore.getState();
  if (express.getState().on && settings?.displayMode === mode && mode !== "immersive") {
    await setSettings({ displayMode: "immersive" });
  }
  await setSettings({ displayMode: mode });
}
