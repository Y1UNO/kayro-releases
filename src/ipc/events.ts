import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  events,
  type AppEntry,
  type AppRunState,
  type DetectProgress,
  type HotkeysReport,
  type ProgressEvent,
  type Settings,
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
