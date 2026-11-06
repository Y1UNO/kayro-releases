import { createStore, useStore } from "zustand";
import type { AppEntry, MoodFile } from "../../ipc/bindings";
import { moodsIpc } from "../../ipc/commands";
import { onMoodsChanged } from "../../ipc/events";
import { MOOD_PACKS } from "../../fx/mood/packs";
import { CUSTOM_MOODS } from "../../fx/mood/custom";
import { moodOf, type FxMood, type Mood } from "../../fx/mood/types";

/**
 * Ambiences (steps 16–17): the built-in packs, the made-to-measure ones (17b) and the user's
 * imported `.hubmood` files (checked by the core, `moods/perso-*.hubmood`). Both windows keep their
 * own copy, updated by the core's `moods-changed` event.
 */
export const NO_MOOD = "aucune";

export const userMoods = createStore<{ list: readonly Mood[] }>(() => ({ list: [] }));

export function setUserMoods(files: readonly MoodFile[]): void {
  userMoods.setState({ list: files.map(moodOf) });
}

export function useUserMoods(): readonly Mood[] {
  return useStore(userMoods, (s) => s.list);
}

/** Every ambience by id: built-in first (an imported one never shadows them: `perso-` ids). */
export function moodById(id: string | null | undefined): Mood | null {
  if (!id || id === NO_MOOD) return null;
  return (
    MOOD_PACKS.find((m) => m.id === id) ??
    CUSTOM_MOODS.find((m) => m.id === id) ??
    userMoods.getState().list.find((m) => m.id === id) ??
    null
  );
}

/** What the atmosphere draws for this app: its ambience and dosage; null = none. */
export function fxMoodOf(app: AppEntry | null | undefined): FxMood | null {
  const mood = moodById(app?.moodId);
  if (!mood) return null;
  return { mood, density: app?.moodTune?.density ?? 1, speed: app?.moodTune?.speed ?? 1 };
}

let started = false;

/** Reads the imported ambiences and follows their changes (local, a few ms). */
export async function loadMoods(): Promise<void> {
  if (started) return;
  started = true;
  await onMoodsChanged(setUserMoods);
  const r = await moodsIpc.list();
  if (r.ok) setUserMoods(r.value);
}
