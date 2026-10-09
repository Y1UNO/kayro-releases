import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  events,
  type AppEntry,
  type AppRunState,
  type DetectProgress,
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
