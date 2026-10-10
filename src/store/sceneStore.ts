import { createStore, type StoreApi } from "zustand";
import type { AppError, ImportPreview, ProgressEvent, SceneFile } from "../ipc/bindings";
import { scenesIpc as realIpc, type Outcome, type ScenesIpc } from "../ipc/commands";
import { onSceneProgress } from "../ipc/events";
import { applyProgress, type RunView } from "./runView";

export interface SceneState {
  loaded: boolean;
  scenes: SceneFile[];
  /** slot name → app id */
  slots: Record<string, string>;
  run: RunView | null;
  lastError: AppError | null;

  init: () => Promise<void>;
  /** Saves a scene and, when given, the slot links it relies on, in that order. */
  save: (scene: SceneFile, slots?: Record<string, string>) => Promise<Outcome<SceneFile>>;
  remove: (id: string) => Promise<Outcome<null>>;
  newId: (name: string) => Promise<string>;
  play: (id: string, closeConfirmed: boolean) => Promise<Outcome<number>>;
  cancel: () => Promise<void>;
  dismissRun: () => void;
  exportScene: (id: string) => Promise<Outcome<string>>;
  importPreview: (path: string) => Promise<Outcome<ImportPreview>>;
  importScene: (path: string, links: Record<string, string>) => Promise<Outcome<SceneFile>>;
  clearError: () => void;
}

export type SceneStore = StoreApi<SceneState>;

export function createSceneStore(
  ipc: ScenesIpc = realIpc,
  subscribe: (h: (e: ProgressEvent) => void) => Promise<() => void> = onSceneProgress,
): SceneStore {
  return createStore<SceneState>()((set, get) => {
    const upsert = (scene: SceneFile) =>
      set((s) => ({
        scenes: s.scenes.some((x) => x.id === scene.id)
          ? s.scenes.map((x) => (x.id === scene.id ? scene : x))
          : [...s.scenes, scene].sort((a, b) => a.id.localeCompare(b.id)),
      }));
    const failed = <T>(r: Outcome<T>): Outcome<T> => {
      if (!r.ok) set({ lastError: r.error });
      return r;
    };

    return {
      loaded: false,
      scenes: [],
      slots: {},
      run: null,
      lastError: null,

      async init() {
        if (get().loaded) return;
        set({ loaded: true });
        const [scenes, slots] = await Promise.all([ipc.list(), ipc.slots()]);
        set({
          scenes: scenes.ok ? scenes.value : [],
          slots: slots.ok ? slots.value.slots : {},
        });
        await subscribe((e) => set((s) => ({ run: applyProgress(s.run, e) })));
      },

      async save(scene, slots) {
        const saved = failed(await ipc.save(scene));
        if (!saved.ok) return saved;
        upsert(saved.value);
        if (slots) {
          const r = failed(await ipc.setSlots(slots));
          if (r.ok) set({ slots: r.value.slots });
          else return { ok: false, error: r.error };
        }
        return saved;
      },

      async remove(id) {
        const r = failed(await ipc.delete(id));
        if (r.ok) set((s) => ({ scenes: s.scenes.filter((x) => x.id !== id) }));
        return r;
      },

      async newId(name) {
        const r = await ipc.newId(name);
        return r.ok ? r.value : "scene";
      },

      async play(id, closeConfirmed) {
        return failed(await ipc.run(id, closeConfirmed));
      },

      async cancel() {
        await ipc.cancel();
      },

      dismissRun() {
        set({ run: null });
      },

      async exportScene(id) {
        return failed(await ipc.exportScene(id));
      },

      async importPreview(path) {
        return ipc.importPreview(path);
      },

      async importScene(path, links) {
        const r = await ipc.importScene(path, links);
        if (!r.ok) return r;
        upsert(r.value);
        const slots = await ipc.slots();
        if (slots.ok) set({ slots: slots.value.slots });
        return r;
      },

      clearError() {
        set({ lastError: null });
      },
    };
  });
}
