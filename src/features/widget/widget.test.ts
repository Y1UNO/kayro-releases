import { describe, expect, it } from "vitest";
import type { AppEntry, SceneFile } from "../../ipc/bindings";
import { categoryApps, recentApps, runningApps, searchPanel } from "./widgetModel";

function app(id: string, name: string, category = "jeux", favorite = false): AppEntry {
  return {
    id,
    name,
    category,
    favorite,
    source: { kind: "manual" },
    launch: { kind: "exe", path: "C:/x.exe", args: [], cwd: null, elevated: false },
    match: { exe: null },
    art: { poster: null, hero: null },
    moodId: null,
  };
}

const scene = (id: string, name: string): SceneFile => ({
  schemaVersion: 1,
  id,
  name,
  steps: [],
});

const APPS = [
  app("discord", "Discord", "stream"),
  app("steam", "Steam"),
  app("spotify", "Spotify", "logiciels"),
  app("minecraft", "Minecraft", "jeux", true),
  app("obs", "OBS Studio", "stream"),
  app("blender", "Blender", "creativite"),
];

describe("widget panel model", () => {
  it("lists only the apps that are running, in list order", () => {
    const state = (id: string, running: boolean) => ({ id, running, foreground: false });
    const out = runningApps(APPS, {
      steam: state("steam", true),
      discord: state("discord", true),
      obs: state("obs", false),
    });
    expect(out.map((a) => a.id)).toEqual(["discord", "steam"]);
  });

  it("shows recents newest first, skips removed apps and stops at four", () => {
    const out = recentApps(APPS, ["obs", "gone", "steam", "blender", "discord", "spotify"]);
    expect(out.map((a) => a.id)).toEqual(["obs", "steam", "blender", "discord"]);
    expect(recentApps(APPS, [])).toEqual([]);
  });

  it("shows the apps of a category with favourites first", () => {
    expect(categoryApps(APPS, "jeux").map((a) => a.id)).toEqual(["minecraft", "steam"]);
    expect(categoryApps(APPS, "stream", 1).map((a) => a.id)).toEqual(["discord"]);
    expect(categoryApps(APPS, "autres")).toEqual([]);
  });

  it("searches scenes then apps, ignoring case and accents, prefix first", () => {
    const scenes = [scene("s1", "Soirée gaming"), scene("s2", "Stream")];
    const names = (q: string) =>
      searchPanel(q, APPS, scenes).map((h) => (h.kind === "scene" ? h.scene.name : h.app.name));
    expect(names("soiree")).toEqual(["Soirée gaming"]);
    expect(names("st")).toEqual(["Stream", "Steam", "OBS Studio"]);
    expect(names("studio")).toEqual(["OBS Studio"]);
    expect(names("   ")).toEqual([]);
    expect(names("zzz")).toEqual([]);
  });

  it("caps the number of results", () => {
    const many = Array.from({ length: 30 }, (_, i) => app(`a${i}`, `App ${i}`));
    expect(searchPanel("app", many, [])).toHaveLength(8);
  });
});
