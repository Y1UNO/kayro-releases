import { describe, expect, it } from "vitest";
import type { AppArt } from "../ipc/bindings";
import type { ArtIpc } from "../ipc/commands";
import type { ArtEvents } from "../ipc/events";
import { artUrl } from "../features/home/art";
import { createArtStore, imageOf } from "./artStore";

const poster = (stamp: string): AppArt => ({
  id: "steam-1",
  images: [{ role: "poster", origin: "steam", stamp, lowRes: true }],
});

function fakes(answers: AppArt[][]) {
  let calls = 0;
  const handlers: { art?: (i: AppArt[]) => void; apps?: () => void } = {};
  const ipc = {
    index: async () => ({
      ok: true as const,
      value: answers[Math.min(calls++, answers.length - 1)],
    }),
  } as unknown as ArtIpc;
  const events: ArtEvents = {
    onArtChanged: async (h) => ((handlers.art = h), () => {}),
    onAppsChanged: async (h) => ((handlers.apps = h), () => {}),
  };
  return { ipc, events, handlers, calls: () => calls };
}

describe("art store", () => {
  it("loads the index once and finds an app's image by role", async () => {
    const f = fakes([[poster("a")]]);
    const store = createArtStore(f.ipc, f.events);
    await store.getState().init();
    await store.getState().init();
    expect(f.calls()).toBe(1);
    expect(imageOf(store.getState(), "steam-1", "poster")?.lowRes).toBe(true);
    expect(imageOf(store.getState(), "steam-1", "hero")).toBeNull();
    expect(imageOf(store.getState(), "other", "poster")).toBeNull();
  });

  it("follows the art events and reloads when the apps change", async () => {
    const f = fakes([[], [poster("b")]]);
    const store = createArtStore(f.ipc, f.events);
    await store.getState().init();
    expect(store.getState().byId).toEqual({});
    f.handlers.apps?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(imageOf(store.getState(), "steam-1", "poster")?.stamp).toBe("b");
    f.handlers.art?.([]);
    expect(store.getState().byId).toEqual({});
  });
});

describe("art URLs", () => {
  it("name an app and a role, never a file, and carry the stamp", () => {
    expect(artUrl("steam-1", { role: "heroBlur", stamp: "1a-2b" })).toBe(
      "http://kayro-art.localhost/steam-1/hero-blur?v=1a-2b",
    );
  });
});
