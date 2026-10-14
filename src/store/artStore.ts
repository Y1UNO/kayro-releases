import { createStore, type StoreApi } from "zustand";
import type { AppArt, ArtImage, ArtRole } from "../ipc/bindings";
import { artIpc as realIpc, type ArtIpc } from "../ipc/commands";
import { artEvents as realEvents, type ArtEvents } from "../ipc/events";

export interface ArtState {
  /** Images of each app that has any, by app id. */
  byId: Record<string, ArtImage[]>;
  init: () => Promise<void>;
}

export type ArtStore = StoreApi<ArtState>;

function byId(index: AppArt[]): Record<string, ArtImage[]> {
  return Object.fromEntries(index.map((a) => [a.id, a.images]));
}

/** The image of `role` of an app, if it has one. */
export function imageOf(state: ArtState, id: string, role: ArtRole): ArtImage | null {
  return state.byId[id]?.find((i) => i.role === role) ?? null;
}

/**
 * Index of the apps' local images (step 14): which app has a poster, a hero, a logo, an icon, and
 * their stamps. Only listings: the images are read by the page through `kayro-art` URLs.
 */
export function createArtStore(ipc: ArtIpc = realIpc, events: ArtEvents = realEvents): ArtStore {
  let started = false;
  return createStore<ArtState>()((set) => {
    const reload = async () => {
      const r = await ipc.index();
      if (r.ok) set({ byId: byId(r.value) });
    };
    return {
      byId: {},
      async init() {
        if (started) return;
        started = true;
        // Subscribe first, then read: a change in between is not lost.
        await Promise.all([
          events.onArtChanged((index) => set({ byId: byId(index) })),
          // A new app (or one edited to another Steam game) may come with images.
          events.onAppsChanged(() => void reload()),
        ]);
        await reload();
      },
    };
  });
}
