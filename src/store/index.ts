import { useStore } from "zustand";
import { createHubStore, type HubState } from "./hubStore";
import { createSceneStore, type SceneState } from "./sceneStore";

export { createHubStore } from "./hubStore";
export type { HubState, HubStore, LoadStatus } from "./hubStore";
export { createSceneStore } from "./sceneStore";
export type { SceneState, SceneStore } from "./sceneStore";
export { applyProgress, doneCount } from "./runView";
export type { RunView, StepView } from "./runView";

/** The app-wide store, backed by the Rust core. */
export const hubStore = createHubStore();

export function useHub<T>(selector: (state: HubState) => T): T {
  return useStore(hubStore, selector);
}

/** Scenes, slots and the progress of the scene being played. */
export const sceneStore = createSceneStore();

export function useScenes<T>(selector: (state: SceneState) => T): T {
  return useStore(sceneStore, selector);
}
