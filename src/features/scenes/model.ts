import type { AppEntry, Step } from "../../ipc/bindings";

/** The five step kinds the editor can build. */
export type StepKind = Step["type"];

export const WAIT_STEP_MS = 2000;
export const WAIT_READY_MS = 30_000;
export const MAX_WAIT_MS = 600_000;

/** Slot names are ids (a-z, 0-9, «-»); this is how one is shown to a person. */
export function slotLabel(slot: string): string {
  const spaced = slot.replace(/-+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const ACCENTS: Record<string, string> = {
  à: "a",
  â: "a",
  ä: "a",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  î: "i",
  ï: "i",
  ô: "o",
  ö: "o",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
};

/** « Plateforme de jeux » → `plateforme-de-jeux` (a valid slot name), or "" when nothing is left. */
export function slugifySlot(text: string): string {
  const plain = [...text.toLowerCase()].map((c) => ACCENTS[c] ?? c).join("");
  return plain
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** Slots a list of steps names, in order of first use. */
export function slotsOf(steps: readonly Step[]): string[] {
  const out: string[] = [];
  for (const s of steps) if ("slot" in s && !out.includes(s.slot)) out.push(s.slot);
  return out;
}

export function secondsText(ms: number): string {
  const s = ms / 1000;
  return Number.isInteger(s) ? String(s) : s.toFixed(1).replace(".", ",");
}

/** What a step looks like in a list: kind, subject (a slot label, a duration…) and the app it reaches. */
export interface StepInfo {
  kind: StepKind;
  /** Slot of the step, null for `wait`. */
  slot: string | null;
  /** Milliseconds for `wait` / `waitReady`. */
  ms: number | null;
}

export function stepInfo(step: Step): StepInfo {
  switch (step.type) {
    case "wait":
      return { kind: "wait", slot: null, ms: step.ms };
    case "waitReady":
      return { kind: "waitReady", slot: step.slot, ms: step.timeoutMs };
    default:
      return { kind: step.type, slot: step.slot, ms: null };
  }
}

/** App linked to a slot, if it still exists. */
export function appOfSlot(
  slot: string,
  links: Readonly<Record<string, string>>,
  apps: readonly AppEntry[],
): AppEntry | undefined {
  const id = links[slot];
  return id ? apps.find((a) => a.id === id) : undefined;
}

/** Apps the `close` steps of a scene will ask to close (shown before the user confirms). */
export function closeTargets(
  steps: readonly Step[],
  links: Readonly<Record<string, string>>,
  apps: readonly AppEntry[],
): string[] {
  const names: string[] = [];
  for (const s of steps) {
    if (s.type !== "close") continue;
    const name = appOfSlot(s.slot, links, apps)?.name;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Parses « 2 », « 2,5 » or « 2.5 » seconds into whole milliseconds, or null. */
export function parseSeconds(text: string, min: number, max: number): number | null {
  const n = Number(text.trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n * 1000)));
}
