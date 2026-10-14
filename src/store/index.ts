import { useStore } from "zustand";
import { createHubStore, type HubState } from "./hubStore";
import { createDesktopStore, type DesktopState } from "./desktopStore";
import { createSceneStore, type SceneState } from "./sceneStore";
import { createArtStore, type ArtState } from "./artStore";

export { createHubStore } from "./hubStore";
export type { HubState, HubStore, LoadStatus } from "./hubStore";
export { createSceneStore } from "./sceneStore";
export type { SceneState, SceneStore } from "./sceneStore";
export { createDesktopStore } from "./desktopStore";
export type { DesktopState, DesktopStore } from "./desktopStore";
export { createArtStore, imageOf, paletteOf } from "./artStore";
export type { ArtState, ArtStore } from "./artStore";
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

/** Recent apps and the state of the global shortcuts. */
export const desktopStore = createDesktopStore();

export function useDesktop<T>(selector: (state: DesktopState) => T): T {
  return useStore(desktopStore, selector);
}

/** Which app has local images (posters, heroes, logos, icons) and their stamps. */
export const artStore = createArtStore();

export function useArt<T>(selector: (state: ArtState) => T): T {
  return useStore(artStore, selector);
}
