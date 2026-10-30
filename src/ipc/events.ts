import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  events,
  type AppArt,
  type AppPalette,
  type AppEntry,
  type AppRunState,
  type DetectProgress,
  type HotkeysReport,
  type ModePassage,
  type ProgressEvent,
  type Settings,
  type MoodFile,
  type ThemeFile,
  type UpdateInfo,
} from "./bindings";

export type Unlisten = () => void;

/** Typed subscriptions to the Rust core's events. */
export interface EventSource {
  onSettingsChanged(handler: (settings: Settings) => void): Promise<Unlisten>;
  onAppsChanged(handler: (apps: AppEntry[]) => void): Promise<Unlisten>;
  /** An app started, stopped, or came to / left the front (changes only). */
  onAppStateChanged(handler: (state: AppRunState) => void): Promise<Unlisten>;
}

const noop: UnlistenFn = () => {};

export const tauriEvents: EventSource = {
  async onSettingsChanged(handler) {
    try {
      return await events.settingsChanged.listen((e) => handler(e.payload));
    } catch {
      return noop; // not running inside Tauri (plain browser, tests)
    }
  },
  async onAppsChanged(handler) {
    try {
      return await events.appsChanged.listen((e) => handler(e.payload.apps));
    } catch {
      return noop;
    }
  },
  async onAppStateChanged(handler) {
    try {
      return await events.appStateChanged.listen((e) => handler(e.payload));
    } catch {
      return noop;
    }
  },
};

/** Progress of a running scan: one event per source and state change. */
export async function onDetectProgress(
  handler: (progress: DetectProgress) => void,
): Promise<Unlisten> {
  try {
    return await events.detectProgress.listen((e) => handler(e.payload));
  } catch {
    return noop;
  }
}

/** Progress of the scene being played: its start, one event per step change, and its end. */
export async function onSceneProgress(handler: (event: ProgressEvent) => void): Promise<Unlisten> {
  try {
    return await events.sceneProgress.listen((e) => handler(e.payload));
  } catch {
    return noop;
  }
}

async function listenTo<T>(
  subscribe: (handler: (e: { payload: T }) => void) => Promise<UnlistenFn>,
  handler: (payload: T) => void,
): Promise<Unlisten> {
  try {
    return await subscribe((e) => handler(e.payload));
  } catch {
    return noop; // not running inside Tauri (plain browser, tests)
  }
}

/** Events of the desktop side (shortcuts, visibility, recent apps). */
export interface DesktopEvents {
  onRecentsChanged(handler: (ids: string[]) => void): Promise<Unlisten>;
  onHotkeysChanged(handler: (report: HotkeysReport) => void): Promise<Unlisten>;
}

export const desktopEvents: DesktopEvents = {
  onRecentsChanged: (handler) => listenTo(events.recentsChanged.listen, handler),
  onHotkeysChanged: (handler) => listenTo(events.hotkeysChanged.listen, handler),
};

/** During a launch cover, the game's window came to the front (its program's file name). */
export function onLaunchLanded(handler: (exe: string) => void): Promise<Unlisten> {
  return listenTo(events.launchLanded.listen, handler);
}

/** The imported ambiences changed (imported or deleted, from either window; steps 16–17). */
export function onMoodsChanged(handler: (moods: MoodFile[]) => void): Promise<Unlisten> {
  return listenTo(events.moodsChanged.listen, handler);
}

/** The personal themes changed (saved, imported or deleted, from either window). */
export function onThemesChanged(handler: (themes: ThemeFile[]) => void): Promise<Unlisten> {
  return listenTo(events.themesChanged.listen, handler);
}

/** The hub appeared or went away; `bench` asks the page to report when it painted. */
export function onWindowVisibility(
  handler: (e: { visible: boolean; bench: boolean }) => void,
): Promise<Unlisten> {
  return listenTo(events.windowVisibility.listen, handler);
}

/** A shortcut asks to confirm a scene that closes apps. */
export function onSceneHotkey(handler: (sceneId: string) => void): Promise<Unlisten> {
  return listenTo(events.sceneHotkey.listen, handler);
}

/** A step of a passage between display modes (round 4b), for the page of window `label`. */
export function onModePassage(handler: (e: ModePassage) => void): Promise<Unlisten> {
  return listenTo(events.modePassage.listen, handler);
}

/** Events the art index follows: the user's images changed, or the app list did. */
export interface ArtEvents {
  onArtChanged(handler: (index: AppArt[]) => void): Promise<Unlisten>;
  onAppsChanged(handler: () => void): Promise<Unlisten>;
  onPalettesChanged(handler: (palettes: AppPalette[]) => void): Promise<Unlisten>;
}

export const artEvents: ArtEvents = {
  onArtChanged: (handler) => listenTo(events.artChanged.listen, handler),
  onAppsChanged: (handler) => listenTo(events.appsChanged.listen, () => handler()),
  onPalettesChanged: (handler) => listenTo(events.palettesChanged.listen, handler),
};

/** Step 18b: the check at start found a newer version. */
export function onUpdateAvailable(handler: (info: UpdateInfo) => void): Promise<Unlisten> {
  return listenTo(events.updateAvailable.listen, handler);
}

/** Step 18b: an update downloading (bytes so far, total when known). */
export function onUpdateProgress(
  handler: (p: { downloaded: number; total: number | null }) => void,
): Promise<Unlisten> {
  return listenTo(events.updateProgress.listen, handler);
}
