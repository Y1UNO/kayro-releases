import { createStore, type StoreApi } from "zustand";
import type {
  AddReport,
  AppEntry,
  AppError,
  AppRunState,
  AppsFile,
  FocusResult,
  LaunchResult,
  NewApp,
  Settings,
  SettingsPatch,
} from "../ipc/bindings";
import { ipc as realIpc, type Ipc, type Outcome } from "../ipc/commands";
import { tauriEvents, type EventSource } from "../ipc/events";

export type LoadStatus = "idle" | "loading" | "ready" | "failed";

export interface HubState {
  status: LoadStatus;
  settings: Settings | null;
  apps: AppEntry[];
  /** Run state by app id; apps whose process cannot be followed have no entry. */
  running: Record<string, AppRunState>;
  /** Last refused or failed operation (the optimistic change has already been rolled back). */
  lastError: AppError | null;
  /** The app whose launch `lastError` is about (null for any other error). */
  failedApp: string | null;
  /** The last app started from Kayro (step 14: « Couleurs du jeu » can follow it). */
  lastLaunched: string | null;

  init: () => Promise<void>;
  addApp: (app: NewApp) => Promise<Outcome<AppEntry>>;
  /** Not optimistic: the core decides which ones are accepted (duplicates, invalid…). */
  addApps: (apps: NewApp[]) => Promise<Outcome<AddReport>>;
  updateApp: (entry: AppEntry) => Promise<Outcome<AppEntry>>;
  /** Step 19b: the apps in the order of `ids` (every app, each once). */
  reorderApps: (ids: string[]) => Promise<Outcome<AppsFile>>;
  removeApp: (id: string) => Promise<Outcome<null>>;
  setSettings: (patch: SettingsPatch) => Promise<Outcome<Settings>>;
  launchApp: (id: string) => Promise<Outcome<LaunchResult>>;
  focusApp: (id: string) => Promise<Outcome<FocusResult>>;
  clearError: () => void;
}

export type HubStore = StoreApi<HubState>;

/**
 * Mirror of the Rust core's data. The store holds no business rule: it applies a change
 * locally at once (optimistic), asks the core, and either takes the core's answer or rolls
 * the change back and records the error.
 */
export function createHubStore(ipc: Ipc = realIpc, events: EventSource = tauriEvents): HubStore {
  let pendingTempId = 0;
  let inFlight = 0;

  return createStore<HubState>()((set, get) => {
    /** Runs one optimistic mutation; events from the core are held back while it is in flight. */
    async function mutate<T>(call: () => Promise<Outcome<T>>): Promise<Outcome<T>> {
      inFlight += 1;
      try {
        const result = await call();
        if (!result.ok) set({ lastError: result.error, failedApp: null });
        return result;
      } finally {
        inFlight -= 1;
      }
    }

    return {
      status: "idle",
      settings: null,
      apps: [],
      running: {},
      lastError: null,
      failedApp: null,
      lastLaunched: null,

      async init() {
        if (get().status === "loading" || get().status === "ready") return;
        set({ status: "loading", lastError: null });
        const [settings, apps, running] = await Promise.all([
          ipc.settingsGet(),
          ipc.appsList(),
          ipc.appsRunning(),
        ]);
        const fail = (error: AppError) => set({ status: "failed", lastError: error });
        if (!settings.ok) return fail(settings.error);
        if (!apps.ok) return fail(apps.error);
        // Run states are a convenience: failing to read them must not block the app.
        set({
          status: "ready",
          settings: settings.value,
          apps: apps.value,
          running: running.ok ? byId(running.value) : {},
        });
        // Subscriptions live as long as the app.
        await Promise.all([
          events.onSettingsChanged((s) => {
            if (inFlight === 0) set({ settings: s });
          }),
          events.onAppsChanged((list) => {
            if (inFlight === 0) set({ apps: list });
          }),
          events.onAppStateChanged((state) => {
            set((s) => ({ running: { ...s.running, [state.id]: state } }));
          }),
        ]);
      },

      async addApp(app) {
        const tempId = `pending-${(pendingTempId += 1)}`;
        set((s) => ({ apps: [...s.apps, { ...app, id: tempId }] }));
        const result = await mutate(() => ipc.appsAdd(app));
        set((s) => ({
          apps: result.ok
            ? s.apps.map((a) => (a.id === tempId ? result.value : a))
            : s.apps.filter((a) => a.id !== tempId),
        }));
        return result;
      },

      async addApps(apps) {
        const result = await mutate(() => ipc.appsAddMany(apps));
        if (result.ok && result.value.added.length > 0) {
          const added = result.value.added;
          set((s) => ({ apps: [...s.apps, ...added] }));
        }
        return result;
      },

      async updateApp(entry) {
        const before = get().apps.find((a) => a.id === entry.id);
        set((s) => ({ apps: s.apps.map((a) => (a.id === entry.id ? entry : a)) }));
        const result = await mutate(() => ipc.appsUpdate(entry));
        set((s) => ({
          apps: s.apps.map((a) =>
            a.id === entry.id ? (result.ok ? result.value : (before ?? a)) : a,
          ),
        }));
        return result;
      },

      async reorderApps(ids) {
        const before = get().apps;
        const byId = new Map(before.map((a) => [a.id, a]));
        const next = ids.map((id) => byId.get(id)).filter((a): a is AppEntry => a !== undefined);
        if (next.length !== before.length) return mutate(() => ipc.appsReorder(ids));
        set({ apps: next });
        const result = await mutate(() => ipc.appsReorder(ids));
        set({ apps: result.ok ? result.value.apps : before });
        return result;
      },

      async removeApp(id) {
        const index = get().apps.findIndex((a) => a.id === id);
        const removed = get().apps[index];
        set((s) => ({ apps: s.apps.filter((a) => a.id !== id) }));
        const result = await mutate(() => ipc.appsRemove(id));
        if (!result.ok && removed) {
          set((s) => {
            const apps = [...s.apps];
            apps.splice(Math.min(index, apps.length), 0, removed);
            return { apps };
          });
        }
        return result;
      },

      async setSettings(patch) {
        const before = get().settings;
        if (before) set({ settings: { ...before, ...definedOnly(patch) } });
        const result = await mutate(() => ipc.settingsSet(patch));
        if (result.ok) set({ settings: result.value });
        else if (before) {
          // Roll back only the fields this call touched.
          set((s) => ({ settings: s.settings && { ...s.settings, ...pick(before, patch) } }));
        }
        return result;
      },

      async launchApp(id) {
        const result = await ipc.appLaunch(id);
        if (!result.ok) set({ lastError: result.error, failedApp: id });
        else set({ lastLaunched: id });
        return result;
      },

      async focusApp(id) {
        const result = await ipc.appFocus(id);
        if (!result.ok) set({ lastError: result.error, failedApp: null });
        return result;
      },

      clearError() {
        set({ lastError: null, failedApp: null });
      },
    };
  });
}

function byId(states: AppRunState[]): Record<string, AppRunState> {
  return Object.fromEntries(states.map((s) => [s.id, s]));
}

function definedOnly(patch: SettingsPatch): Partial<Settings> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<Settings>;
}

function pick(from: Settings, patch: SettingsPatch): Partial<Settings> {
  const keys = Object.keys(definedOnly(patch)) as (keyof Settings)[];
  return Object.fromEntries(keys.map((k) => [k, from[k]])) as Partial<Settings>;
}
