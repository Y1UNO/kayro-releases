import { createStore, useStore } from "zustand";
import type {
  VoiceHeard,
  VoiceModelInfo,
  VoiceModelProgress,
  VoiceSettings,
  VoiceState,
} from "../../ipc/bindings";
import { voiceIpc } from "../../ipc/commands";
import { onVoiceHeard, onVoiceModelProgress, onVoiceState } from "../../ipc/events";

/**
 * Step 21, the voice as the page sees it: where it stands (the microphone indicator), its models
 * and their downloads, the last command heard. The work (microphone, models, network) is the
 * core's (src-tauri/src/voice/).
 */
export interface VoiceView {
  state: VoiceState;
  models: VoiceModelInfo[];
  progress: Record<string, VoiceModelProgress>;
  /** The last command heard: a note shows it; a close or a doubt waits for an answer. */
  heard: VoiceHeard | null;
  /** « Ouvre les réglages de la voix »: the page of Réglages to open (the home screen does). */
  settingsPage: string | null;
}

export const voiceStore = createStore<VoiceView>()(() => ({
  state: { status: "off", missing: null },
  models: [],
  progress: {},
  heard: null,
  settingsPage: null,
}));

/** A command heard: its note, and a page of Réglages to open when it asked for one. */
function noteHeard(heard: VoiceHeard): void {
  const page = heard.outcome.kind === "settings" ? heard.outcome.page : null;
  voiceStore.setState((s) => ({ heard, settingsPage: page ?? s.settingsPage }));
}

export function settingsShown(): void {
  voiceStore.setState({ settingsPage: null });
}

export const useVoice = <T>(pick: (s: VoiceView) => T): T => useStore(voiceStore, pick);

/** The models a setting needs: the command's, and in the always mode the two that listen. */
export function neededModels(v: VoiceSettings): string[] {
  if (v.mode === "off") return [];
  return v.mode === "always" ? ["silero", "wake", v.model] : [v.model];
}

/** Listening, or about to (the microphone is open or opens as soon as it can). */
export function micOpen(status: VoiceState["status"]): boolean {
  return (
    status === "waiting" ||
    status === "hearing" ||
    status === "thinking" ||
    status === "following"
  );
}

export async function refreshModels(): Promise<void> {
  const r = await voiceIpc.models();
  if (r.ok) voiceStore.setState({ models: r.value });
}

let started = false;

/**
 * Follows the core, once per page. `main`: Kayro's window, which also takes a command that waited
 * for an answer while it loaded (the island does not).
 */
export function startVoice(main: boolean): void {
  if (started) return;
  started = true;
  void voiceIpc.state().then((r) => r.ok && voiceStore.setState({ state: r.value }));
  void refreshModels();
  if (main) {
    void voiceIpc.takePending().then((r) => {
      if (r.ok && r.value) noteHeard(r.value);
    });
  }
  void onVoiceState((state) => voiceStore.setState({ state }));
  void onVoiceHeard(noteHeard);
  void onVoiceModelProgress((p) => {
    voiceStore.setState((s) => ({ progress: { ...s.progress, [p.id]: p } }));
    if (p.step !== "downloading") void refreshModels();
  });
}

export function dismissHeard(): void {
  voiceStore.setState({ heard: null });
}

/**
 * A Spotify share link (« https://open.spotify.com/intl-fr/playlist/<id>?si=… ») or address, as
 * the address Kayro keeps (« spotify:playlist:<id> »); null for anything else.
 */
export function spotifyUri(text: string): string | null {
  const t = text.trim();
  const kinds = "(playlist|album|track|artist|show|episode)";
  const m =
    new RegExp(`^spotify:${kinds}:([A-Za-z0-9]{22})$`).exec(t) ??
    new RegExp(
      String.raw`^https?://open\.spotify\.com/(?:intl-[a-z]{2}(?:-[a-z]{2})?/)?` +
        `${kinds}/([A-Za-z0-9]{22})(?:[?#].*)?$`,
    ).exec(t);
  return m ? `spotify:${m[1]}:${m[2]}` : null;
}
