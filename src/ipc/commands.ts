// Thin layer over the GENERATED bindings (`bindings.ts`, never edited by hand): every command
// answers with an `Outcome` instead of throwing, so callers handle failure explicitly.
import { commands, type AppEntry, type AppError, type NewApp, type Settings } from "./bindings";
import type {
  AppRunState,
  FocusResult,
  LaunchResult,
  ScanReport,
  SettingsPatch,
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
  appReady: (): Promise<Outcome<null>> => checked(commands.appReady()),
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
