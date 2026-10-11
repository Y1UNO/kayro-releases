// Live link between the workshop (`/dev/atelier`) and its previews (iframes of the real screens
// with `?atelier=A|B`). Same-origin BroadcastChannel: no network, dev builds only.
import type { DaValues } from "../../design/da";
import { daStore, parsePreset } from "../../design/da";
import { runBench, type BenchResult } from "../bench";

export type Side = "A" | "B";

export type ToPreview =
  | { to: Side; type: "values"; values: DaValues }
  | { to: Side; type: "bench"; ms: number; keyHz: number };

export type FromPreview =
  { from: Side; type: "hello" } | { from: Side; type: "bench"; result: BenchResult };

export const CHANNEL = "kayro-da";

/** In a preview page: applies the values it receives and runs the frame bench on request. */
export function listenAsPreview(side: string | null): void {
  if (side !== "A" && side !== "B") return;
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (e: MessageEvent<ToPreview>) => {
    const m = e.data;
    if (m.to !== side) return;
    if (m.type === "values") daStore.getState().replace(m.values);
    else if (m.type === "bench") {
      void runBench(m.ms, m.keyHz).then((result) => {
        const reply: FromPreview = { from: side, type: "bench", result };
        ch.postMessage(reply);
      });
    }
  };
  const hello: FromPreview = { from: side, type: "hello" };
  ch.postMessage(hello);
}

/** `?preset=<file name>`: applies a saved preset to this page (dev bench in the Tauri window). */
export async function applyPresetParam(slug: string | null): Promise<void> {
  if (!slug) return;
  const r = (await (await fetch("/__atelier/presets")).json()) as {
    presets: { file: string; preset: unknown }[];
  };
  const found = r.presets.find((p) => p.file === `${slug}.json`);
  const parsed = found ? parsePreset(found.preset) : null;
  if (parsed?.ok) daStore.getState().replace(parsed.preset.values);
  else console.warn(`preset « ${slug} » not found or invalid`);
}
