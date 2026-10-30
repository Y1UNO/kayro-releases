import { createStore } from "zustand";
import { useStore } from "zustand";
import type { AppError, UpdateInfo } from "../../ipc/bindings";
import { updateIpc } from "../../ipc/commands";
import { onUpdateAvailable, onUpdateProgress } from "../../ipc/events";

/**
 * Step 18b, the updates as the page sees them: what the last check said, the dialog, the download.
 * The work (network, signature, install) is the core's (src-tauri/src/update.rs).
 */
export type UpdateStatus = "idle" | "checking" | "upToDate" | "available" | "downloading" | "error";

export interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  /** 0–1 while downloading (null: size unknown). */
  progress: number | null;
  error: AppError | null;
  /** The update dialog is open. */
  open: boolean;
  /** A newer version found at start: the home shows its notice once. */
  announced: UpdateInfo | null;
}

export const updateStore = createStore<UpdateState>()(() => ({
  status: "idle",
  info: null,
  progress: null,
  error: null,
  open: false,
  announced: null,
}));

export const useUpdate = <T>(pick: (s: UpdateState) => T): T => useStore(updateStore, pick);

/** « Rechercher une mise à jour »: opens the dialog when something newer exists. */
export async function checkForUpdate(): Promise<void> {
  updateStore.setState({ status: "checking", error: null });
  const r = await updateIpc.check();
  if (!r.ok) return updateStore.setState({ status: "error", error: r.error });
  if (!r.value) return updateStore.setState({ status: "upToDate", info: null });
  updateStore.setState({ status: "available", info: r.value, open: true });
}

/** Downloads, verifies and installs; Kayro quits and starts again on the new version. */
export async function installUpdate(): Promise<void> {
  updateStore.setState({ status: "downloading", progress: 0, error: null });
  const r = await updateIpc.install();
  // Only reached when it failed: on success Kayro has already quit.
  if (!r.ok) updateStore.setState({ status: "error", error: r.error, progress: null });
}

export function openUpdate(open: boolean): void {
  updateStore.setState({ open, announced: null });
}

let listening = false;

/** Once per page: the check at start and the download's progress. */
export function listenForUpdates(): void {
  if (listening) return;
  listening = true;
  void onUpdateAvailable((info) =>
    updateStore.setState({ status: "available", info, announced: info }),
  );
  void onUpdateProgress(({ downloaded, total }) =>
    updateStore.setState({ progress: total ? Math.min(1, downloaded / total) : null }),
  );
}

/** The release notes as points: one per line, list marks removed. */
export function notePoints(notes: string | null | undefined): string[] {
  return (notes ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•✦]\s*/, "").trim())
    .filter(Boolean);
}
