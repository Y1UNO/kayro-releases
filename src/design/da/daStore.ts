import { createStore, useStore } from "zustand";
import type { DaValue, DaValues, ElementValues } from "./catalogue";
import { ELEMENTS } from "./catalogue";
import { defaultValues, elementDefaults, parsePreset } from "./values";
import active from "./active.json";

export interface DaState {
  values: DaValues;
  setParam: (id: string, key: string, value: DaValue) => void;
  setOn: (id: string, on: boolean) => void;
  /** Back to the catalogue defaults (one element, or all). */
  reset: (id?: string) => void;
  replace: (values: DaValues) => void;
}

/** The exported art direction (active.json), or the catalogue defaults if it is invalid. */
export function activeValues(): DaValues {
  const r = parsePreset(active);
  if (!r.ok) {
    console.warn(`active.json ignored: ${r.error}`);
    return defaultValues();
  }
  return r.preset.values;
}

/** Theme the exported direction was tuned with (dev pages use it when no theme is given). */
export const ACTIVE_THEME_ID: string = (active as { themeId?: string }).themeId ?? "";

function patch(values: DaValues, id: string, change: Partial<ElementValues>): DaValues {
  const cur = values[id];
  if (!cur) return values;
  return { ...values, [id]: { ...cur, ...change } as ElementValues };
}

export const daStore = createStore<DaState>()((set) => ({
  values: activeValues(),
  setParam: (id, key, value) => set((s) => ({ values: patch(s.values, id, { [key]: value }) })),
  setOn: (id, on) => set((s) => ({ values: patch(s.values, id, { on }) })),
  reset: (id) =>
    set((s) => {
      if (!id) return { values: defaultValues() };
      const el = ELEMENTS.get(id);
      return el ? { values: { ...s.values, [id]: elementDefaults(el) } } : s;
    }),
  replace: (values) => set({ values }),
}));

export function useDa<T>(selector: (s: DaState) => T): T {
  return useStore(daStore, selector);
}
