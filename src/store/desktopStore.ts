import { createStore, type StoreApi } from "zustand";
import type { HotkeysReport } from "../ipc/bindings";
import { desktopIpc as realIpc, type DesktopIpc } from "../ipc/commands";
import { desktopEvents as realEvents, type DesktopEvents } from "../ipc/events";

export interface DesktopState {
  /** Ids of the apps launched most recently, newest first. */
  recents: string[];
  /** What happened when the shortcuts were registered (null until known). */
  hotkeys: HotkeysReport | null;
  init: () => Promise<void>;
}

export type DesktopStore = StoreApi<DesktopState>;

/** Desktop-side facts the interface only reads: recent apps and the state of the shortcuts. */
export function createDesktopStore(
  ipc: DesktopIpc = realIpc,
  events: DesktopEvents = realEvents,
): DesktopStore {
  let started = false;
  return createStore<DesktopState>()((set) => ({
    recents: [],
    hotkeys: null,
    async init() {
      if (started) return;
      started = true;
      // Subscribe first, then read: a change in between is not lost.
      await Promise.all([
        events.onRecentsChanged((recents) => set({ recents })),
        events.onHotkeysChanged((hotkeys) => set({ hotkeys })),
      ]);
      const [recents, hotkeys] = await Promise.all([ipc.recents(), ipc.hotkeys()]);
      if (recents.ok) set({ recents: recents.value });
      if (hotkeys.ok) set({ hotkeys: hotkeys.value });
    },
  }));
}
