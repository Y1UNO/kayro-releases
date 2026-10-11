// Development page for the scene screens (step 11): `/dev/scenes`, dev builds only (see main.tsx).
// Fake apps, and the scene store's actions replaced by in-memory ones, so the dock, the list and
// both editors can be tried in a plain browser (nothing is saved, nothing is started).
//   ?empty=1 (no scene)   ?screen=scenes|editor|home   ?theme=…
import { useState } from "react";
import { ThemeProvider } from "../design";
import { ACTIVE_THEME_ID } from "../design/da";
import { Atmosphere } from "../fx";
import { HomeScreen } from "../features/home/HomeScreen";
import { SceneEditor } from "../features/scenes/SceneEditor";
import { ScenesScreen } from "../features/scenes/ScenesScreen";
import { SceneToast } from "../features/scenes/SceneToast";
import type { AppEntry, ProgressEvent, SceneFile } from "../ipc/bindings";
import { applyProgress, hubStore, sceneStore } from "../store";

function app(id: string, name: string, exe: string | null, over: Partial<AppEntry> = {}): AppEntry {
  return {
    id,
    name,
    category: "logiciels",
    source: { kind: "manual" },
    launch: { kind: "exe", path: `C:/${id}.exe`, args: [], cwd: null, elevated: false },
    match: { exe },
    art: { poster: null, hero: null },
    moodId: null,
    favorite: false,
    ...over,
  };
}

const APPS: AppEntry[] = [
  app("discord", "Discord", "discord.exe"),
  app("steam", "Steam", "steam.exe", { launch: { kind: "uri", uri: "steam://open/main" } }),
  app("spotify", "Spotify", "spotify.exe"),
  app("obs", "OBS Studio", "obs64.exe"),
  app("notes", "Bloc-notes", null, { launch: { kind: "lnk", path: "C:/notes.lnk" } }),
  app("hades", "Hades", null, {
    source: { kind: "steam", appId: "1145360" },
    launch: { kind: "uri", uri: "steam://rungameid/1145360" },
  }),
];

const SCENES: SceneFile[] = [
  {
    schemaVersion: 1,
    id: "soiree-gaming",
    name: "Soirée gaming",
    hotkey: "Ctrl+Alt+1",
    steps: [
      { type: "launch", slot: "messagerie" },
      { type: "wait", ms: 2000 },
      { type: "launch", slot: "plateforme-jeux" },
      { type: "waitReady", slot: "plateforme-jeux", timeoutMs: 30000 },
      { type: "launch", slot: "musique" },
    ],
  },
  {
    schemaVersion: 1,
    id: "stream",
    name: "Stream",
    steps: [
      { type: "launch", slot: "obs" },
      { type: "focus", slot: "obs", required: true },
      { type: "close", slot: "musique" },
    ],
  },
];

const SLOTS = { messagerie: "discord", "plateforme-jeux": "steam", musique: "spotify", obs: "obs" };

let runId = 0;
/** Plays a scene on a timer, with the same events as the core. */
function fakePlay(id: string) {
  const scene = sceneStore.getState().scenes.find((s) => s.id === id);
  if (!scene) return;
  const me = (runId += 1);
  const push = (update: ProgressEvent["update"]) =>
    sceneStore.setState((s) => ({ run: applyProgress(s.run, { runId: me, sceneId: id, update }) }));
  push({ kind: "started", total: scene.steps.length });
  let i = 0;
  const tick = () => {
    if (sceneStore.getState().run?.runId !== me) return;
    if (i > 0) push({ kind: "step", index: i - 1, state: "ok", reason: null });
    if (i === scene.steps.length) return push({ kind: "finished", status: "completed" });
    push({ kind: "step", index: i, state: "running", reason: null });
    i += 1;
    window.setTimeout(tick, 900);
  };
  tick();
}

function install(params: URLSearchParams) {
  hubStore.setState({ status: "ready", apps: APPS, settings: null, running: {} });
  sceneStore.setState({
    loaded: true,
    scenes: params.has("empty") ? [] : SCENES,
    slots: params.has("empty") ? {} : SLOTS,
    run: null,
    save: (scene, slots) => {
      sceneStore.setState((s) => ({
        scenes: [...s.scenes.filter((x) => x.id !== scene.id), scene],
        slots: slots ?? s.slots,
      }));
      return Promise.resolve({ ok: true, value: scene });
    },
    newId: (name) => Promise.resolve(name.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
    remove: (id) => {
      sceneStore.setState((s) => ({ scenes: s.scenes.filter((x) => x.id !== id) }));
      return Promise.resolve({ ok: true, value: null });
    },
    play: (id) => {
      fakePlay(id);
      return Promise.resolve({ ok: true, value: runId });
    },
    cancel: () => {
      sceneStore.setState((s) => ({
        run: s.run && { ...s.run, status: "cancelled" },
      }));
      return Promise.resolve();
    },
    exportScene: (id) => Promise.resolve({ ok: true, value: `C:\\fake\\${id}.hubscene` }),
  });
}

export default function ScenesDev() {
  const params = new URLSearchParams(location.search);
  useState(() => install(params)); // once, before the first render
  const [screen, setScreen] = useState<"home" | "scenes" | { editor: string | null }>(
    params.get("screen") === "editor"
      ? { editor: SCENES[0]?.id ?? null }
      : ((params.get("screen") as "home" | "scenes" | null) ?? "scenes"),
  );
  return (
    <ThemeProvider initialThemeId={params.get("theme") ?? ACTIVE_THEME_ID}>
      <Atmosphere />
      {screen === "home" && <HomeScreen onOpenScenes={() => setScreen("scenes")} />}
      {screen === "scenes" && (
        <ScenesScreen onBack={() => setScreen("home")} onEdit={(id) => setScreen({ editor: id })} />
      )}
      {typeof screen === "object" && (
        <SceneEditor
          key={screen.editor ?? "new"}
          sceneId={screen.editor}
          onBack={() => setScreen("scenes")}
        />
      )}
      <SceneToast />
    </ThemeProvider>
  );
}
