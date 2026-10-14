import { createStore, type StoreApi } from "zustand";
import type { AppArt, AppPalette, ArtImage, ArtRole, PaletteSource } from "../ipc/bindings";
import { artIpc as realIpc, type ArtIpc } from "../ipc/commands";
import { artEvents as realEvents, type ArtEvents } from "../ipc/events";

export interface ArtState {
  /** Images of each app that has any, by app id. */
  byId: Record<string, ArtImage[]>;
  /** Colours taken from each app's images (poster, hero, or icon when it has neither). */
  palettes: Record<string, AppPalette[]>;
  init: () => Promise<void>;
}

export type ArtStore = StoreApi<ArtState>;

function byId(index: AppArt[]): Record<string, ArtImage[]> {
  return Object.fromEntries(index.map((a) => [a.id, a.images]));
}

function palettesById(list: AppPalette[]): Record<string, AppPalette[]> {
  const out: Record<string, AppPalette[]> = {};
  for (const p of list) (out[p.id] ??= []).push(p);
  return out;
}

/** The palette of an app taken from `source`, if there is one. */
export function paletteOf(state: ArtState, id: string, source: PaletteSource): AppPalette | null {
  return state.palettes[id]?.find((p) => p.source === source) ?? null;
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
      palettes: {},
      async init() {
        if (started) return;
        started = true;
        // Subscribe first, then read: a change in between is not lost.
        await Promise.all([
          events.onArtChanged((index) => set({ byId: byId(index) })),
          // A new app (or one edited to another Steam game) may come with images.
          events.onAppsChanged(() => void reload()),
          events.onPalettesChanged((list) => set({ palettes: palettesById(list) })),
        ]);
        const [, palettes] = await Promise.all([reload(), ipc.palettes()]);
        if (palettes.ok) set({ palettes: palettesById(palettes.value) });
      },
    };
  });
}
