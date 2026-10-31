// Thin layer over the GENERATED bindings (`bindings.ts`, never edited by hand): every command
// answers with an `Outcome` instead of throwing, so callers handle failure explicitly.
import {
  commands,
  type AppEntry,
  type AppError,
  type AppsFile,
  type DetectedApp,
  type FxFrame,
  type IslandState,
  type MediaAction,
  type NowPlaying,
  type NewApp,
  type Settings,
  type StartupApp,
  type UpdateInfo,
} from "./bindings";
import type {
  AddReport,
  OpeningDue,
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
  VeilFade,
  AppArt,
  AppPalette,
  ArtRole,
  MoodFile,
  ThemeFile,
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
  /** Step 19b: every app's id in the new order of the cards. */
  appsReorder: (ids: string[]): Promise<Outcome<AppsFile>> => checked(commands.appsReorder(ids)),
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
  /** Step 19c, « Scan avancé »: the usual scan, then the PC's program and game folders. */
  deep: (): Promise<Outcome<ScanReport>> => checked(commands.detectDeep()),
  /** Step 19b: the icon of a proposed app (`data:` URL), or null. */
  icon: (app: DetectedApp): Promise<Outcome<string | null>> => checked(commands.detectIcon(app)),
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
  /**
   * Launch cover (30/10): `on` keeps the hub in front while a game starts behind it; off ends
   * it, `hide` taking the hub off the screen.
   */
  launchCover: (on: boolean, hide: boolean): Promise<Outcome<void>> =>
    plain(commands.launchCover(on, hide)),
  /** « Après l'intro : Kysland », already in the widget mode: the intro's window gives way to it. */
  /** « Après l'intro »: the intro's window goes; the island comes (`island`) or nothing. */
  introDone: (island: boolean): Promise<Outcome<void>> => plain(commands.introDone(island)),
  /** Shows Kayro (the island's « Passer en immersif »). */
  show: (): Promise<Outcome<void>> => plain(commands.windowShow()),
  /** Step 20 (Kysland): a press on the island; the core drives the gesture from there. */
  islandGrab: (calm: boolean): Promise<Outcome<void>> => plain(commands.islandGrab(calm)),
  /** Step 20: where the island is (on the top edge or floating, and in which corner). */
  islandState: (): Promise<Outcome<IslandState>> => plain(commands.islandState()),
  /** Step 20: the island opens or closes (its panel): the core gives its window that region. */
  islandOpen: (open: boolean, calm: boolean): Promise<Outcome<void>> =>
    plain(commands.islandOpen(open, calm)),
  /** The opened island's size, which follows its content (logical pixels). */
  islandPanel: (width: number, height: number): Promise<Outcome<void>> =>
    plain(commands.islandPanel(width, height)),
  /** Step 20: the island's largest size at rest (logical), for its click region. */
  islandFootprint: (width: number, height: number): Promise<Outcome<void>> =>
    plain(commands.islandFootprint(width, height)),
  /** Step 20: a held frame of the island's effects (the glitch's spikes on an edge). */
  islandEffects: (frame: FxFrame): Promise<Outcome<void>> => plain(commands.islandEffects(frame)),
  /** Step 20: the island's effects are over (the core cuts its window to it again). */
  islandRest: (): Promise<Outcome<void>> => plain(commands.islandRest()),
  /** Step 20: the lightness of the screen around the island (0–1), for its colours. */
  islandBackdrop: (): Promise<Outcome<number | null>> => plain(commands.islandBackdrop()),
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
  /** Step 19: the apps Windows starts at login (Réglages › Démarrage). */
  startupApps: (): Promise<Outcome<StartupApp[]>> => checked(commands.startupApps()),
  setStartupApp: (id: string, enabled: boolean): Promise<Outcome<StartupApp[]>> =>
    checked(commands.startupAppSet(id, enabled)),
  /** Puts back every app Kayro switched off, exactly as it was. */
  restoreStartupApps: (): Promise<Outcome<StartupApp[]>> => checked(commands.startupAppsRestore()),
  setAutostart: (enabled: boolean): Promise<Outcome<boolean>> =>
    checked(commands.autostartSet(enabled)),
  /** Zips the logs into the exports folder and shows it in Explorer; returns the zip's path. */
  exportLogs: (): Promise<Outcome<string>> => checked(commands.logsExport()),
  recents: (): Promise<Outcome<string[]>> => plain(commands.recentsGet()),
  /** Once per run of the program, at the first show: the opening animation (round 3). */
  openingDue: (): Promise<Outcome<OpeningDue>> => plain(commands.openingDue()),
  /**
   * The page has faded out for a passage between modes (round 4b): the core goes on. `veil`: how
   * the native veil fades when `main` gives way to the widget or takes over from it.
   */
  passageFaded: (id: number, veil: VeilFade | null = null): Promise<Outcome<void>> =>
    plain(commands.passageFaded(id, veil)),
};

export type DesktopIpc = typeof desktopIpc;

/** Local images of the apps (step 14). The images themselves come through `kayro-art` URLs. */
export const artIpc = {
  index: (): Promise<Outcome<AppArt[]>> => checked(commands.artIndex()),
  /** Copies a dropped image as the app's poster (or hero, logo); answers the new index. */
  setUser: (id: string, role: ArtRole, path: string): Promise<Outcome<AppArt[]>> =>
    checked(commands.artSetUser(id, role, path)),
  clearUser: (id: string, role: ArtRole): Promise<Outcome<AppArt[]>> =>
    checked(commands.artClearUser(id, role)),
  /** Colours taken from the images so far (computed by the core in the background). */
  palettes: (): Promise<Outcome<AppPalette[]>> => plain(commands.palettesGet()),
};

export type ArtIpc = typeof artIpc;

/** Personal themes (step 15): made in Réglages › Thèmes, imported from a dropped `.json`. */
export const themesIpc = {
  list: (): Promise<Outcome<ThemeFile[]>> => plain(commands.themesList()),
  newId: (name: string): Promise<Outcome<string>> => plain(commands.themeNewId(name)),
  save: (theme: ThemeFile): Promise<Outcome<ThemeFile>> => checked(commands.themeSave(theme)),
  remove: (id: string): Promise<Outcome<null>> => checked(commands.themeDelete(id)),
  /** Reads and validates the file, then keeps it as a new personal theme. */
  importFile: (path: string): Promise<Outcome<ThemeFile>> => checked(commands.themeImport(path)),
  /** Writes the shareable file in the exports folder, shows it in Explorer; returns its path. */
  exportFile: (id: string): Promise<Outcome<string>> => checked(commands.themeExport(id)),
};

export type ThemesIpc = typeof themesIpc;

/** Ambiences (steps 16–17): the imported `.hubmood` files; the built-in packs live in the page. */
export const moodsIpc = {
  list: (): Promise<Outcome<MoodFile[]>> => plain(commands.moodsList()),
  /** Reads and validates the file, then keeps it as a new ambience. */
  importFile: (path: string): Promise<Outcome<MoodFile>> => checked(commands.moodImport(path)),
  remove: (id: string): Promise<Outcome<null>> => checked(commands.moodDelete(id)),
  /** Writes the ambience in the exports folder, shows it in Explorer; returns its path. */
  exportFile: (mood: MoodFile): Promise<Outcome<string>> => checked(commands.moodExport(mood)),
};

/**
 * Step 18b, updates: the only network of Kayro (the project's signed releases), on demand or at
 * start if allowed. `install` downloads, checks the signature, installs: Kayro quits and restarts.
 */
export const updateIpc = {
  check: (): Promise<Outcome<UpdateInfo | null>> => checked(commands.updateCheck()),
  /** What the check at start found (it may end before the page listens). */
  pending: (): Promise<Outcome<UpdateInfo | null>> => plain(commands.updatePending()),
  install: (): Promise<Outcome<null>> => checked(commands.updateInstall()),
};

/** Step 20 (Kysland): the music playing on the PC (Windows' media controls, Spotify first). */
export const mediaIpc = {
  now: (): Promise<Outcome<NowPlaying | null>> => plain(commands.mediaNow()),
  control: (action: MediaAction): Promise<Outcome<boolean>> => plain(commands.mediaControl(action)),
  /** Follow the beat (the island's bars) while music plays and the island shows. */
  beat: (on: boolean): Promise<Outcome<void>> => plain(commands.mediaBeat(on)),
};
