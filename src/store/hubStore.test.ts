import { describe, expect, it, vi } from "vitest";
import type { AppEntry, AppError, NewApp, Settings } from "../ipc/bindings";
import type { Ipc, Outcome } from "../ipc/commands";
import type { EventSource } from "../ipc/events";
import { createHubStore } from "./hubStore";

const SETTINGS: Settings = {
  schemaVersion: 1,
  themeId: "crepuscule",
  quality: "balanced",
  colorMode: "light",
  hotkey: "Ctrl+Alt+H",
  language: "fr",
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
    appsUpdate: async (e) => ok(e),
    appsRemove: async () => ok(null),
    appReady: async () => ok(null),
    ...over,
  };
}

function stripNulls(p: object): Partial<Settings> {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v != null)) as Partial<Settings>;
}

const silentEvents: EventSource = {
  onSettingsChanged: async () => () => {},
  onAppsChanged: async () => () => {},
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
        onSettingsChanged: async () => () => {},
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
        onSettingsChanged: async () => () => {},
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
