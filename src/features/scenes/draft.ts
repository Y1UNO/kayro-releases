// The scene being edited: pure state and transitions, so the editor logic is testable without a DOM.
import type { AppEntry, SceneFile, Step } from "../../ipc/bindings";
import { WAIT_READY_MS, WAIT_STEP_MS, slotsOf, type StepKind } from "./model";
import {
  MAX_SIMPLE_ITEMS,
  generateSteps,
  toSimple,
  type Sequence,
  type SimpleDraft,
} from "./simple";

export type EditorMode = "simple" | "advanced";

export interface DraftStep {
  /** Stable identity for lists and drag and drop (not saved). */
  key: number;
  step: Step;
}

export interface EditorDraft {
  /** null until the first save: the core then picks the id. */
  id: string | null;
  name: string;
  hotkey: string | null;
  mode: EditorMode;
  simple: SimpleDraft;
  /** Steps of the advanced mode (the simple mode generates its own). */
  steps: DraftStep[];
  /** Every slot link (slot name → app id), edited here and saved with the scene. */
  links: Record<string, string>;
  /** Slots added in the panel that no step uses yet. */
  extraSlots: string[];
  /** Key of the step whose details are open. */
  selected: number | null;
}

let keyCounter = 0;
const nextKey = () => (keyCounter += 1);
const keyed = (steps: readonly Step[]): DraftStep[] =>
  steps.map((step) => ({ key: nextKey(), step }));

export const EMPTY_SIMPLE: SimpleDraft = { items: [], sequence: "oneByOne" };

export function newDraft(links: Record<string, string>): EditorDraft {
  return {
    id: null,
    name: "",
    hotkey: null,
    mode: "simple",
    simple: EMPTY_SIMPLE,
    steps: [],
    links,
    extraSlots: [],
    selected: null,
  };
}

/** A saved scene opens in simple mode when the simple mode can make exactly its steps. */
export function draftFromScene(
  scene: SceneFile,
  links: Record<string, string>,
  apps: readonly AppEntry[],
): EditorDraft {
  const base: EditorDraft = {
    ...newDraft({ ...links }),
    id: scene.id,
    name: scene.name,
    hotkey: scene.hotkey ?? null,
    steps: keyed(scene.steps),
  };
  const simple = scene.steps.length > 0 ? toSimple(scene.steps, { apps, links }) : null;
  return simple ? { ...base, mode: "simple", simple: simple.draft } : { ...base, mode: "advanced" };
}

/** Steps and links as they would be saved now, whatever the mode. */
export function resolved(
  draft: EditorDraft,
  apps: readonly AppEntry[],
): { steps: Step[]; links: Record<string, string> } {
  if (draft.mode === "advanced") {
    return { steps: draft.steps.map((s) => s.step), links: draft.links };
  }
  return generateSteps(draft.simple, { apps, links: draft.links });
}

/** Slots shown in the panel: the ones the steps use, then the ones just added. */
export function panelSlots(draft: EditorDraft, apps: readonly AppEntry[]): string[] {
  const used = slotsOf(resolved(draft, apps).steps);
  return [...used, ...draft.extraSlots.filter((s) => !used.includes(s))];
}

export function toScene(draft: EditorDraft, apps: readonly AppEntry[], id: string): SceneFile {
  const { steps } = resolved(draft, apps);
  return {
    schemaVersion: 1,
    id,
    name: draft.name.trim(),
    hotkey: draft.hotkey,
    steps,
  };
}

/** Everything that decides what gets saved, for « unsaved changes ». */
export function snapshot(draft: EditorDraft, apps: readonly AppEntry[]): string {
  const { steps, links } = resolved(draft, apps);
  return JSON.stringify([draft.name.trim(), draft.hotkey, steps, links]);
}

export const isSaveable = (draft: EditorDraft, apps: readonly AppEntry[]) =>
  draft.name.trim().length > 0 && resolved(draft, apps).steps.length > 0;

export type Action =
  | { type: "name"; name: string }
  | { type: "hotkey"; hotkey: string | null }
  | { type: "sequence"; sequence: Sequence }
  | { type: "addApp"; appId: string; index?: number }
  | { type: "ready"; appId: string; ready: boolean }
  | { type: "moveItem"; from: number; to: number }
  | { type: "removeItem"; appId: string }
  | { type: "addStep"; kind: StepKind }
  | { type: "patchStep"; key: number; patch: Partial<Step> }
  | { type: "moveStep"; from: number; to: number }
  | { type: "removeStep"; key: number }
  | { type: "select"; key: number | null }
  | { type: "link"; slot: string; appId: string | null }
  | { type: "addSlot"; slot: string }
  | { type: "deleteSlot"; slot: string; keepLink: boolean }
  | { type: "toAdvanced"; apps: readonly AppEntry[] }
  | { type: "toSimple"; simple: SimpleDraft };

export function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list.slice();
  const out = list.slice();
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, item as T);
  return out;
}

/** Step added from the palette: a slot to act on is chosen for the user when there is one. */
function freshStep(kind: StepKind, slot: string): Step {
  switch (kind) {
    case "wait":
      return { type: "wait", ms: WAIT_STEP_MS };
    case "waitReady":
      return { type: "waitReady", slot, timeoutMs: WAIT_READY_MS };
    default:
      return { type: kind, slot };
  }
}

function newSlotName(links: Record<string, string>, taken: readonly string[]): string {
  for (let n = 1; ; n += 1) {
    const slot = `emplacement-${n}`;
    if (!(slot in links) && !taken.includes(slot)) return slot;
  }
}

export function reduce(draft: EditorDraft, action: Action): EditorDraft {
  switch (action.type) {
    case "name":
      return { ...draft, name: action.name };
    case "hotkey":
      return { ...draft, hotkey: action.hotkey };

    case "sequence":
      return { ...draft, simple: { ...draft.simple, sequence: action.sequence } };
    case "addApp": {
      const { items } = draft.simple;
      if (items.some((i) => i.appId === action.appId) || items.length >= MAX_SIMPLE_ITEMS) {
        return draft;
      }
      const at = Math.max(0, Math.min(action.index ?? items.length, items.length));
      const next = [
        ...items.slice(0, at),
        { appId: action.appId, ready: true },
        ...items.slice(at),
      ];
      return { ...draft, simple: { ...draft.simple, items: next } };
    }
    case "ready":
      return {
        ...draft,
        simple: {
          ...draft.simple,
          items: draft.simple.items.map((i) =>
            i.appId === action.appId ? { ...i, ready: action.ready } : i,
          ),
        },
      };
    case "moveItem":
      return {
        ...draft,
        simple: { ...draft.simple, items: move(draft.simple.items, action.from, action.to) },
      };
    case "removeItem":
      return {
        ...draft,
        simple: {
          ...draft.simple,
          items: draft.simple.items.filter((i) => i.appId !== action.appId),
        },
      };

    case "addStep": {
      const used = slotsOf(draft.steps.map((s) => s.step));
      const { links } = draft;
      let { extraSlots } = draft;
      let slot = used.at(-1) ?? Object.keys(links)[0] ?? extraSlots[0] ?? "";
      if (action.kind !== "wait" && slot === "") {
        slot = newSlotName(links, extraSlots);
        extraSlots = [...extraSlots, slot];
      }
      const added: DraftStep = { key: nextKey(), step: freshStep(action.kind, slot) };
      return { ...draft, steps: [...draft.steps, added], links, extraSlots, selected: added.key };
    }
    case "patchStep":
      return {
        ...draft,
        steps: draft.steps.map((s) =>
          s.key === action.key ? { ...s, step: { ...s.step, ...action.patch } as Step } : s,
        ),
      };
    case "moveStep":
      return { ...draft, steps: move(draft.steps, action.from, action.to) };
    case "removeStep":
      return {
        ...draft,
        steps: draft.steps.filter((s) => s.key !== action.key),
        selected: draft.selected === action.key ? null : draft.selected,
      };
    case "select":
      return { ...draft, selected: action.key };

    case "link": {
      const links = { ...draft.links };
      if (action.appId) links[action.slot] = action.appId;
      else delete links[action.slot];
      return { ...draft, links };
    }
    case "addSlot": {
      if (
        draft.extraSlots.includes(action.slot) ||
        slotsOf(draft.steps.map((s) => s.step)).includes(action.slot)
      ) {
        return draft;
      }
      return { ...draft, extraSlots: [...draft.extraSlots, action.slot] };
    }
    case "deleteSlot": {
      const links = { ...draft.links };
      if (!action.keepLink) delete links[action.slot];
      return {
        ...draft,
        links,
        extraSlots: draft.extraSlots.filter((s) => s !== action.slot),
        steps: draft.steps.filter((s) => !("slot" in s.step) || s.step.slot !== action.slot),
        selected: null,
      };
    }

    case "toAdvanced": {
      const out = generateSteps(draft.simple, { apps: action.apps, links: draft.links });
      return {
        ...draft,
        mode: "advanced",
        steps: keyed(out.steps),
        links: out.links,
        selected: null,
      };
    }
    case "toSimple":
      return { ...draft, mode: "simple", simple: action.simple, selected: null };
  }
}

/** Advanced → simple: the draft to switch to, or null when the steps are not simple ones. */
export function trySimple(
  draft: EditorDraft,
  apps: readonly AppEntry[],
): { simple: SimpleDraft; links: Record<string, string> } | null {
  const steps = draft.steps.map((s) => s.step);
  const found = toSimple(steps, { apps, links: draft.links });
  return found ? { simple: found.draft, links: found.links } : null;
}
