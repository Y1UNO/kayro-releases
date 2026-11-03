import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  events,
  type AppArt,
  type AppPalette,
  type AppEntry,
  type AppRunState,
  type HotkeysReport,
  type IslandFrame,
  type IslandMoment,
  type IslandStage,
  type IslandTucked,
  type NowPlaying,
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

/**
 * This window (Kayro's, or the island's) appeared or went away; `bench` asks the page to report
 * when it painted. Only this window's: the island comes when Kayro goes, and the other way round.
 */
export function onWindowVisibility(
  handler: (e: { visible: boolean; bench: boolean }) => void,
): Promise<Unlisten> {
  let own: ReturnType<typeof events.windowVisibility>;
  try {
    own = events.windowVisibility(getCurrentWebviewWindow());
  } catch {
    return Promise.resolve(noop); // not running inside Tauri (plain browser, tests)
  }
  return listenTo(own.listen, handler);
}

/** Step 20 (Kysland): one frame of a gesture on the island (stretch, lean, magnet). */
export function onIslandFrame(handler: (f: IslandFrame) => void): Promise<Unlisten> {
  return listenTo(events.islandFrame.listen, handler);
}

/** Step 20: a moment of a gesture on the island (torn off, through an edge, docked…). */
export function onIslandMoment(handler: (m: IslandMoment) => void): Promise<Unlisten> {
  return listenTo(events.islandMoment.listen, handler);
}

/** « Cacher l'île »: the core brought the island out of the top edge (the cursor touched it). */
export function onIslandTucked(handler: (e: IslandTucked) => void): Promise<Unlisten> {
  return listenTo(events.islandTucked.listen, handler);
}

/** Music mode: the island is back (`on` false: the window has its size again). */
export function onIslandStage(handler: (e: IslandStage) => void): Promise<Unlisten> {
  return listenTo(events.islandStage.listen, handler);
}

/** Step 20: the music playing changed (null: nothing plays any more). */
export function onMediaChanged(handler: (now: NowPlaying | null) => void): Promise<Unlisten> {
  return listenTo(events.mediaChanged.listen, handler);
}

/** Step 20: the beat, five levels (0–1) from the bass up, about 30 times a second. */
export function onMediaBeat(handler: (levels: number[]) => void): Promise<Unlisten> {
  return listenTo(events.mediaBeat.listen, (levels) => handler(levels.map((l) => l ?? 0)));
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
/** Step 19c: where the advanced scan is (folders read, apps found, looking for logos). */
export function onDeepProgress(
  handler: (p: { folders: number; found: number; logos: boolean }) => void,
): Promise<Unlisten> {
  return listenTo(events.deepProgress.listen, handler);
}

export function onUpdateProgress(
  handler: (p: { downloaded: number; total: number | null }) => void,
): Promise<Unlisten> {
  return listenTo(events.updateProgress.listen, handler);
}
