import { createStore, useStore } from "zustand";
import type { HandsModelInfo, HandsState, VoiceModelProgress } from "../../ipc/bindings";
import { handsIpc } from "../../ipc/commands";
import { onHandsState, onVoiceModelProgress } from "../../ipc/events";

/**
 * Step 22, the hands as the page sees them: where they stand (camera on, a hand leading the
 * cursor), their two models and their download. The work (camera, models, cursor) is the core's
 * (src-tauri/src/hands/).
 */
export interface HandsView {
  state: HandsState;
  model: HandsModelInfo | null;
  progress: VoiceModelProgress | null;
}

/** The download's id in `VoiceModelProgress` (the voice's downloader brings the hands' too). */
export const HANDS_MODEL = "hands";

export const handsStore = createStore<HandsView>()(() => ({
  state: { status: "off", on: false },
  model: null,
  progress: null,
}));

export function useHands<T>(pick: (s: HandsView) => T): T {
  return useStore(handsStore, pick);
}

export async function refreshHandsModel(): Promise<void> {
  const r = await handsIpc.model();
  if (r.ok) handsStore.setState({ model: r.value });
}

let started = false;

/** Follows the core, once per page. */
export function startHands(): void {
  if (started) return;
  started = true;
  void handsIpc.state().then((r) => r.ok && handsStore.setState({ state: r.value }));
  void refreshHandsModel();
  void onHandsState((state) => handsStore.setState({ state }));
  void onVoiceModelProgress((p) => {
    if (p.id !== HANDS_MODEL) return;
    handsStore.setState({ progress: p.step === "downloading" ? p : null });
    if (p.step !== "downloading") void refreshHandsModel();
  });
}
