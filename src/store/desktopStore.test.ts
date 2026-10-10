import { describe, expect, it } from "vitest";
import type { HotkeysReport } from "../ipc/bindings";
import type { DesktopIpc, Outcome } from "../ipc/commands";
import type { DesktopEvents } from "../ipc/events";
import { createDesktopStore } from "./desktopStore";

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });

const REPORT: HotkeysReport = {
  toggle: { hotkey: "Ctrl+Alt+H", problem: "conflict" },
  scenes: [],
};

function fakeIpc(over: Partial<DesktopIpc> = {}): DesktopIpc {
  const never = () => Promise.reject(new Error("not used"));
  return {
    hide: never,
    drag: never,
    fitWidget: never,
    painted: never,
    monitors: never,
    chooseMonitor: never,
    setHotkey: never,
    hotkeys: async () => ok(REPORT),
    takePendingScene: never,
    autostart: never,
    setAutostart: never,
    recents: async () => ok(["a", "b"]),
    ...over,
  } as DesktopIpc;
}

function fakeEvents() {
  const handlers: { recents?: (ids: string[]) => void; hotkeys?: (r: HotkeysReport) => void } = {};
  const events: DesktopEvents = {
    onRecentsChanged: async (h) => {
      handlers.recents = h;
      return () => {};
    },
    onHotkeysChanged: async (h) => {
      handlers.hotkeys = h;
      return () => {};
    },
  };
  return { events, handlers };
}

describe("desktop store", () => {
  it("starts with the recents and the shortcut report from the core", async () => {
    const { events } = fakeEvents();
    const store = createDesktopStore(fakeIpc(), events);
    await store.getState().init();
    expect(store.getState().recents).toEqual(["a", "b"]);
    expect(store.getState().hotkeys?.toggle?.problem).toBe("conflict");
  });

  it("follows the events afterwards", async () => {
    const { events, handlers } = fakeEvents();
    const store = createDesktopStore(fakeIpc(), events);
    await store.getState().init();
    handlers.recents?.(["c"]);
    handlers.hotkeys?.({ toggle: { hotkey: "Ctrl+Alt+J", problem: null }, scenes: [] });
    expect(store.getState().recents).toEqual(["c"]);
    expect(store.getState().hotkeys?.toggle?.hotkey).toBe("Ctrl+Alt+J");
  });

  it("keeps working when a read fails, and only subscribes once", async () => {
    let subscriptions = 0;
    const events: DesktopEvents = {
      onRecentsChanged: async () => {
        subscriptions += 1;
        return () => {};
      },
      onHotkeysChanged: async () => () => {},
    };
    const failing = fakeIpc({
      recents: async () => ({
        ok: false,
        error: { code: "internal", message: "x", field: null },
      }),
    });
    const store = createDesktopStore(failing, events);
    await store.getState().init();
    await store.getState().init();
    expect(store.getState().recents).toEqual([]);
    expect(store.getState().hotkeys).not.toBeNull();
    expect(subscriptions).toBe(1);
  });
});
