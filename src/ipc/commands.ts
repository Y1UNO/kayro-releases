// Thin layer over the GENERATED bindings (`bindings.ts`, never edited by hand): every command
// answers with an `Outcome` instead of throwing, so callers handle failure explicitly.
import { commands, type AppEntry, type AppError, type NewApp, type Settings } from "./bindings";
import type {
  AddReport,
  ImportPreview,
  SceneFile,
  SlotsFile,
  AppRunState,
  InspectReport,
  FocusResult,
  LaunchResult,
  ScanReport,
  SettingsPatch,
  HotkeysReport,
  MonitorInfo,
} from "./bindings";

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: AppError };

type Generated<T> = Promise<{ status: "ok"; data: T } | { status: "error"; error: AppError }>;

function internal(e: unknown): AppError {
  return { code: "internal", message: e instanceof Error ? e.message : String(e), field: null };
}

/** For commands that cannot fail on their own: only the transport can throw. */
async function plain<T>(call: Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await call };
  } catch (e) {
    return { ok: false, error: internal(e) };
  }
}

/** For commands returning `Result<T, AppError>`. */
async function checked<T>(call: Generated<T>): Promise<Outcome<T>> {
  try {
    const r = await call;
    return r.status === "ok" ? { ok: true, value: r.data } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: internal(e) };
  }
}

export const ipc = {
  settingsGet: (): Promise<Outcome<Settings>> => plain(commands.settingsGet()),
  settingsSet: (patch: SettingsPatch): Promise<Outcome<Settings>> =>
    checked(commands.settingsSet(patch)),
  appsList: (): Promise<Outcome<AppEntry[]>> => plain(commands.appsList()),
  appsAdd: (app: NewApp): Promise<Outcome<AppEntry>> => checked(commands.appsAdd(app)),
  appsUpdate: (entry: AppEntry): Promise<Outcome<AppEntry>> => checked(commands.appsUpdate(entry)),
  appsRemove: (id: string): Promise<Outcome<null>> => checked(commands.appsRemove(id)),
  /** Adds several apps with one write; the refused ones are listed in `failed`. */
  appsAddMany: (apps: NewApp[]): Promise<Outcome<AddReport>> => checked(commands.appsAddMany(apps)),
  /** Proposes apps for dropped / pasted files and addresses. Read-only. */
  appsInspect: (inputs: string[]): Promise<Outcome<InspectReport>> =>
    checked(commands.appsInspect(inputs)),
  /** The app's icon as a `data:` URL, or null when it has none. */
  appIcon: (id: string): Promise<Outcome<string | null>> => checked(commands.appIcon(id)),
  /** True when the core showed the window for a shortcut that is being measured. */
  appReady: (): Promise<Outcome<boolean>> => plain(commands.appReady()),
  /** The one way to start an app: an app already open is brought to the front instead. */
  appLaunch: (id: string): Promise<Outcome<LaunchResult>> => checked(commands.appLaunch(id)),
  appFocus: (id: string): Promise<Outcome<FocusResult>> => checked(commands.appFocus(id)),
  /** Apps whose process can be followed; the others are simply absent. */
  appsRunning: (): Promise<Outcome<AppRunState[]>> => plain(commands.appsRunning()),
};

/** Shape of the client, so the store can be tested with a fake. */
export type Ipc = typeof ipc;

/** App detection (Steam, Epic, Start Menu). Read-only: it proposes apps, `appsAdd` adds them. */
export const detect = {
  /** Resolves with what was found; a newer scan cancels this one. */
  scan: (): Promise<Outcome<ScanReport>> => checked(commands.detectScan()),
  cancel: (): Promise<Outcome<void>> => plain(commands.detectCancel()),
};

/** Scenes, slots, and the sharing of scenes (`.hubscene`). */
export const scenesIpc = {
  list: (): Promise<Outcome<SceneFile[]>> => plain(commands.scenesList()),
  save: (scene: SceneFile): Promise<Outcome<SceneFile>> => checked(commands.scenesSave(scene)),
  delete: (id: string): Promise<Outcome<null>> => checked(commands.scenesDelete(id)),
  newId: (name: string): Promise<Outcome<string>> => plain(commands.scenesNewId(name)),
  slots: (): Promise<Outcome<SlotsFile>> => plain(commands.slotsGet()),
  setSlots: (slots: Record<string, string>): Promise<Outcome<SlotsFile>> =>
    checked(commands.slotsSet(slots)),
  /** Starts a scene; progress arrives as `scene-progress` events. */
  run: (id: string, closeConfirmed: boolean): Promise<Outcome<number>> =>
    checked(commands.sceneRun(id, closeConfirmed)),
  cancel: (): Promise<Outcome<boolean>> => plain(commands.sceneCancel()),
  /** Writes the shareable file and returns where it is. */
  exportScene: (id: string): Promise<Outcome<string>> => checked(commands.sceneExport(id)),
  importPreview: (path: string): Promise<Outcome<ImportPreview>> =>
    checked(commands.sceneImportPreview(path)),
  importScene: (path: string, links: Record<string, string>): Promise<Outcome<SceneFile>> =>
    checked(commands.sceneImport(path, links)),
};

export type ScenesIpc = typeof scenesIpc;

/** Showing, hiding and fitting the window, screens, shortcuts, starting with Windows, recent apps. */
export const desktopIpc = {
  hide: (): Promise<Outcome<void>> => plain(commands.windowHide()),
  /** Starts moving the window with the mouse (call from a pointer-down). */
  drag: (): Promise<Outcome<null>> => checked(commands.windowDrag()),
  /** The widget window follows the size of its content (logical pixels). */
  fitWidget: (width: number, height: number): Promise<Outcome<null>> =>
    checked(commands.widgetFit(width, height)),
  /** Measurement only: the page painted after being shown. */
  painted: (): Promise<Outcome<void>> => plain(commands.windowPainted()),
  monitors: (): Promise<Outcome<MonitorInfo[]>> => plain(commands.monitorsList()),
  chooseMonitor: (name: string): Promise<Outcome<null>> => checked(commands.monitorChoose(name)),
  /** Refused with `hotkeyConflict` when another program owns the combination. */
  setHotkey: (hotkey: string): Promise<Outcome<null>> => checked(commands.hotkeySet(hotkey)),
  hotkeys: (): Promise<Outcome<HotkeysReport>> => plain(commands.hotkeysGet()),
  /** The scene a shortcut asked to confirm while the page was not there to hear it. */
  takePendingScene: (): Promise<Outcome<string | null>> => plain(commands.sceneHotkeyTake()),
  autostart: (): Promise<Outcome<boolean>> => checked(commands.autostartGet()),
  setAutostart: (enabled: boolean): Promise<Outcome<boolean>> =>
    checked(commands.autostartSet(enabled)),
  recents: (): Promise<Outcome<string[]>> => plain(commands.recentsGet()),
};

export type DesktopIpc = typeof desktopIpc;
