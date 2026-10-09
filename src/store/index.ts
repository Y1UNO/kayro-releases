import { useStore } from "zustand";
import { createHubStore, type HubState } from "./hubStore";

export { createHubStore } from "./hubStore";
export type { HubState, HubStore, LoadStatus } from "./hubStore";

/** The app-wide store, backed by the Rust core. */
export const hubStore = createHubStore();

export function useHub<T>(selector: (state: HubState) => T): T {
  return useStore(hubStore, selector);
}
