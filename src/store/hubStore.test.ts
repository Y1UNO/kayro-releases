import { describe, expect, it, vi } from "vitest";
import type { AppEntry, AppError, NewApp, Settings } from "../ipc/bindings";
import type { Ipc, Outcome } from "../ipc/commands";
import type { EventSource } from "../ipc/events";
import { createHubStore } from "./hubStore";
import { SOUND_DEFAULTS, UPDATE_DEFAULTS, VISUAL_DEFAULTS } from "../features/settings/settingsModel";

const SETTINGS: Settings = {
  ...VISUAL_DEFAULTS,
  ...SOUND_DEFAULTS,
  ...UPDATE_DEFAULTS,
  schemaVersion: 2,
  themeId: "crepuscule",
  openingScreen: "last",
  quality: "balanced",
  colorMode: "light",
  hotkey: "Ctrl+Alt+H",
  language: "fr",
  atmosphereIntensity: 1,
  displayMode: "immersive",
  hideOnEscape: true,
  hideOnBlur: false,
  economyMode: false,
};

function entry(id: string, over: Partial<AppEntry> = {}): AppEntry {
  return {
    id,
    name: id,
    category: "jeux",
    source: { kind: "manual" },
    launch: { kind: "exe", path: "C:\\a.exe", args: [], cwd: null, elevated: false },
    match: { exe: null },
    art: { poster: null, hero: null },
    moodId: null,
    favorite: false,
    ...over,
  };
}

const REFUSED: AppError = { code: "validation", message: "no", field: "name" };
const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const refused = <T>(): Outcome<T> => ({ ok: false, error: REFUSED });

/** A fake core whose answers are controlled by the test. */
function fakeIpc(over: Partial<Ipc> = {}): Ipc {
  return {
    settingsGet: async () => ok(SETTINGS),
    settingsSet: async (p) => ok({ ...SETTINGS, ...stripNulls(p) }),
    appsList: async () => ok([entry("one"), entry("two")]),
    appsAdd: async (a: NewApp) => ok({ ...a, id: "added" }),
    appsAddMany: async (list: NewApp[]) =>
      ok({ added: list.map((a, i) => ({ ...a, id: `added-${i}` })), failed: [] }),
    appsInspect: async () => ok({ candidates: [], refused: [] }),
    appIcon: async () => ok(null),
    appsUpdate: async (e) => ok(e),
    appsRemove: async () => ok(null),
    appReady: async () => ok(false),
    appLaunch: async () => ok({ kind: "started", pid: 1 }),
    appFocus: async () => ok("focused"),
    appsRunning: async () => ok([]),
    ...over,
  };
}

function stripNulls(p: object): Partial<Settings> {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v != null)) as Partial<Settings>;
}

const silentEvents: EventSource = {
  onSettingsChanged: async () => () => {},
  onAppsChanged: async () => () => {},
  onAppStateChanged: async () => () => {},
};

async function ready(over: Partial<Ipc> = {}, events: EventSource = silentEvents) {
  const store = createHubStore(fakeIpc(over), events);
  await store.getState().init();
  return store;
}

describe("init", () => {
  it("loads settings and apps", async () => {
    const store = await ready();
    const s = store.getState();
    expect([s.status, s.apps.length, s.settings?.themeId]).toEqual(["ready", 2, "crepuscule"]);
  });

  it("reports a failed load without throwing", async () => {
    const store = await ready({ appsList: async () => refused() });
    expect(store.getState().status).toBe("failed");
    expect(store.getState().lastError).toEqual(REFUSED);
  });

  it("applies events pushed by the core", async () => {
    let pushApps: (a: AppEntry[]) => void = () => {};
    const store = await ready(
      {},
      {
        ...silentEvents,
        onAppsChanged: async (h) => {
          pushApps = h;
          return () => {};
        },
      },
    );
    pushApps([entry("pushed")]);
    expect(store.getState().apps.map((a) => a.id)).toEqual(["pushed"]);
  });
});

describe("adding several apps", () => {
  it("shows only what the core accepted, once, at the end of the list", async () => {
    const accepted = entry("new-1");
    const store = await ready({
      appsAddMany: async () =>
        ok({ added: [accepted], failed: [{ index: 1, error: { ...REFUSED, code: "duplicate" } }] }),
    });
    const r = await store.getState().addApps([{} as NewApp, {} as NewApp]);
    expect(r.ok && r.value.failed.length).toBe(1);
    expect(store.getState().apps.map((a) => a.id)).toEqual(["one", "two", "new-1"]);
  });

  it("changes nothing when the whole call fails, and records the error", async () => {
    const store = await ready({ appsAddMany: async () => refused() });
    const r = await store.getState().addApps([{} as NewApp]);
    expect(r.ok).toBe(false);
    expect(store.getState().apps.map((a) => a.id)).toEqual(["one", "two"]);
    expect(store.getState().lastError).toEqual(REFUSED);
  });
});

describe("optimistic updates", () => {
  it("shows an added app at once, then swaps in the core's version", async () => {
    let release: (o: Outcome<AppEntry>) => void = () => {};
    const store = await ready({ appsAdd: () => new Promise((r) => (release = r)) });
    const pending = store.getState().addApp({ ...entry("x"), id: undefined } as unknown as NewApp);
    expect(store.getState().apps).toHaveLength(3);
    expect(store.getState().apps[2]?.id).toMatch(/^pending-/);
    release(ok(entry("real-id")));
    await pending;
    expect(store.getState().apps.map((a) => a.id)).toEqual(["one", "two", "real-id"]);
  });

  it("rolls back a refused add and records the error", async () => {
    const store = await ready({ appsAdd: async () => refused() });
    const r = await store.getState().addApp({} as NewApp);
    expect(r.ok).toBe(false);
    expect(store.getState().apps.map((a) => a.id)).toEqual(["one", "two"]);
    expect(store.getState().lastError).toEqual(REFUSED);
  });

  it("rolls back a refused update to the previous value", async () => {
    const store = await ready({ appsUpdate: async () => refused() });
    await store.getState().updateApp(entry("one", { name: "renamed", favorite: true }));
    expect(store.getState().apps[0]).toEqual(entry("one"));
  });

  it("keeps an accepted update", async () => {
    const store = await ready();
    await store.getState().updateApp(entry("two", { favorite: true }));
    expect(store.getState().apps[1]?.favorite).toBe(true);
  });

  it("puts a refused removal back at its place", async () => {
    const store = await ready({ appsRemove: async () => refused() });
    const pending = store.getState().removeApp("one");
    expect(store.getState().apps.map((a) => a.id)).toEqual(["two"]);
    await pending;
    expect(store.getState().apps.map((a) => a.id)).toEqual(["one", "two"]);
  });

  it("removes for good when accepted", async () => {
    const store = await ready();
    await store.getState().removeApp("one");
    expect(store.getState().apps.map((a) => a.id)).toEqual(["two"]);
  });

  it("applies a settings patch at once and rolls back only its own fields", async () => {
    const store = await ready({ settingsSet: async () => refused() });
    const pending = store.getState().setSettings({ quality: "ultra" });
    expect(store.getState().settings?.quality).toBe("ultra");
    await pending;
    expect(store.getState().settings).toEqual(SETTINGS);
    expect(store.getState().lastError?.code).toBe("validation");
  });

  it("holds back core events while a change is in flight", async () => {
    let pushApps: (a: AppEntry[]) => void = () => {};
    let release: (o: Outcome<null>) => void = () => {};
    const store = await ready(
      { appsRemove: () => new Promise((r) => (release = r)) },
      {
        ...silentEvents,
        onAppsChanged: async (h) => {
          pushApps = h;
          return () => {};
        },
      },
    );
    const pending = store.getState().removeApp("one");
    pushApps([entry("one"), entry("two")]); // stale list sent by the core mid-flight
    expect(store.getState().apps.map((a) => a.id)).toEqual(["two"]);
    release(ok(null));
    await pending;
    expect(store.getState().apps.map((a) => a.id)).toEqual(["two"]);
  });

  it("clears the error on request", async () => {
    const store = await ready({ appsRemove: async () => refused() });
    await store.getState().removeApp("one");
    store.getState().clearError();
    expect(store.getState().lastError).toBeNull();
  });
});

describe("launching and run state", () => {
  const state = (id: string, running: boolean, foreground = false) => ({ id, running, foreground });

  it("starts with the run states known to the core", async () => {
    const store = await ready({ appsRunning: async () => ok([state("one", true)]) });
    expect(store.getState().running).toEqual({ one: state("one", true) });
  });

  it("still loads when the run states cannot be read", async () => {
    const store = await ready({ appsRunning: async () => refused() });
    expect(store.getState().status).toBe("ready");
    expect(store.getState().running).toEqual({});
  });

  it("follows app-state-changed events", async () => {
    let push: (s: ReturnType<typeof state>) => void = () => {};
    const store = await ready(
      {},
      {
        ...silentEvents,
        onAppStateChanged: async (h) => {
          push = h;
          return () => {};
        },
      },
    );
    push(state("one", true, true));
    push(state("two", true));
    push(state("one", true));
    expect(store.getState().running).toEqual({ one: state("one", true), two: state("two", true) });
  });

  it("returns the launch result and records a refusal as the last error", async () => {
    const store = await ready();
    expect(await store.getState().launchApp("one")).toEqual(ok({ kind: "started", pid: 1 }));
    const failing = await ready({ appLaunch: async () => refused() });
    const r = await failing.getState().launchApp("one");
    expect(r.ok).toBe(false);
    expect(failing.getState().lastError).toEqual(REFUSED);
    // Round 4b: the message names the app and its card shakes.
    expect(failing.getState().failedApp).toBe("one");
    failing.getState().clearError();
    expect(failing.getState().failedApp).toBeNull();
  });

  it("an error that is not a launch is about no app", async () => {
    const store = await ready({
      appLaunch: async () => refused(),
      appFocus: async () => refused(),
    });
    await store.getState().launchApp("one");
    await store.getState().focusApp("one");
    expect(store.getState().failedApp).toBeNull();
  });

  it("focus goes through the core too", async () => {
    const store = await ready({ appFocus: async () => ok("notRunning") });
    expect(await store.getState().focusApp("one")).toEqual(ok("notRunning"));
  });
});

describe("transport failure", () => {
  it("is turned into an internal error by the ipc layer, never an exception", async () => {
    const { ipc } = await import("../ipc/commands");
    vi.stubGlobal("window", undefined);
    const r = await ipc.appsList(); // no Tauri here: invoke throws
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("internal");
    vi.unstubAllGlobals();
  });
});
