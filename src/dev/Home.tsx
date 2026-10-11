// Development page for the home screen (step 7): `/dev/home`, dev builds only (see main.tsx).
// It fills the store with fake apps, so the screen can be checked in a plain browser:
//   ?theme=<theme id> (default: the exported art direction's)   ?atelier=A|B (workshop preview)   ?apps=60 (all in "jeux")   ?empty=1
//   ?view=grid   ?bench=1 (frame-time measurement while scrolling fast)   ?bench=idle (no input)
//   ?fx=eco|balanced|high|ultra (quality, default high)   ?intensity=0.3…1   ?nodust=1 (CSS layer only)
//   ?addmock=1 (fake core for the add / edit dialogs: detected apps, drop, add, edit, remove)
//   ?fps=N (cadence of the continuous layers, instead of the budget's)
//   ?posters=1 (a stand-in poster on every card)   ?cycle=ms (clicks the next category tab every ms: watch the glass selection pill slide)
import { useEffect, useState } from "react";
import { QUALITIES, ThemeProvider, applyQuality } from "../design";
import { Atmosphere } from "../fx";
import { DustLayer } from "../fx/canvas/dust";
import { CssFxLayer } from "../fx/css/cssFx";
import { HomeScreen } from "../features/home/HomeScreen";
import type { AppEntry } from "../ipc/bindings";
import { ipc } from "../ipc/commands";
import { hubStore } from "../store";
import { installAddAppsMock } from "./addAppsMock";
import { runBench, type BenchResult } from "./bench";
import { setDevPoster } from "../features/home/art";

/** Colourful pictures of the repository, as stand-in game posters (dev server only). */
const DEV_POSTERS = ["140406", "140411", "140423"].map(
  (t) => `/reference/inspirations/Capture d%27%C3%A9cran 2026-10-11 ${t}.png`,
);
import { ACTIVE_THEME_ID } from "../design/da";

const MOCK: Record<string, string[]> = {
  jeux: ["Riot Client", "Minecraft", "Steam", "Epic Games", "Battle.net"],
  stream: ["Streamlabs", "Twitch", "OBS Studio", "Discord", "Spotify"],
  creativite: ["Krita", "DaVinci Resolve", "Blender", "Figma", "Ableton Live"],
  logiciels: ["Terminal", "Firefox", "VS Code", "Notion", "7-Zip"],
  autres: ["Photos", "Bloc-notes", "Paramètres", "Calculatrice", "Musique"],
};

function entry(name: string, category: string, i: number): AppEntry {
  return {
    id: `${category}-${i}`,
    name,
    category,
    source: { kind: "manual" },
    launch: { kind: "exe", path: "C:/fake.exe", args: [], cwd: null, elevated: false },
    match: { exe: null },
    art: { poster: null, hero: null },
    moodId: null,
    favorite: false,
  };
}

function seed(params: URLSearchParams): AppEntry[] {
  if (params.has("empty")) return [];
  const n = Number(params.get("apps"));
  if (n > 0) return Array.from({ length: n }, (_, i) => entry(`Application ${i + 1}`, "jeux", i));
  return Object.entries(MOCK).flatMap(([cat, names]) => names.map((nm, i) => entry(nm, cat, i)));
}

/** Bench variants of the atmosphere layers (undefined = the normal ones). */
function benchLayers(params: URLSearchParams) {
  const fps = Number(params.get("fps")) || undefined;
  const noDust = params.has("nodust");
  if (!fps && !noDust) return undefined;
  return () =>
    noDust ? [new CssFxLayer({ fps })] : [new CssFxLayer({ fps }), new DustLayer({ fps })];
}

(window as unknown as { __runBench: typeof runBench }).__runBench = runBench;

export default function HomeDev() {
  const params = new URLSearchParams(location.search);
  if (params.has("posters")) setDevPoster(DEV_POSTERS);
  const [bench, setBench] = useState<BenchResult | null>(null);
  const [ready] = useState(() => {
    const apps = seed(params);
    hubStore.setState({
      status: "ready",
      apps,
      settings: {
        schemaVersion: 1,
        themeId: params.get("theme") ?? ACTIVE_THEME_ID,
        quality: QUALITIES.find((q) => q === params.get("fx")) ?? "high",
        colorMode: "light",
        hotkey: "Ctrl+Alt+H",
        language: "fr",
        atmosphereIntensity: Number(params.get("intensity")) || 1,
        displayMode: "immersive",
        widgetStyle: "brume",
        hideOnEscape: true,
        hideOnBlur: false,
        economyMode: false,
      },
      // Fake launch: the app just shows as "open".
      launchApp: (id: string) => {
        hubStore.setState((s) => ({
          running: { ...s.running, [id]: { id, running: true, foreground: true } },
        }));
        return Promise.resolve({
          ok: true as const,
          value: { kind: "started" as const, pid: null },
        });
      },
    });
    if (params.has("addmock")) installAddAppsMock(() => hubStore.getState().apps);
    applyQuality(hubStore.getState().settings?.quality ?? "high");
    if (params.has("running")) {
      const first = apps[2];
      if (first)
        hubStore.setState({
          running: { [first.id]: { id: first.id, running: true, foreground: false } },
        });
    }
    return true;
  });

  useEffect(() => {
    // Inside the Tauri window (not a plain browser): show it, like <App /> does.
    if ("__TAURI_INTERNALS__" in window) void ipc.appReady();
  }, []);

  useEffect(() => {
    const ms = Number(params.get("cycle"));
    if (!(ms > 0)) return;
    let i = 0;
    const id = window.setInterval(() => {
      const tabs = document.querySelectorAll<HTMLElement>("[role=tab]");
      i = (i + 1) % Math.max(1, tabs.length);
      tabs[i]?.click();
    }, ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!params.has("bench")) return;
    const id = window.setTimeout(() => {
      if (params.get("view") === "grid")
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Home" }));
      void runBench(10_000, params.get("bench") === "idle" ? 0 : 30).then((r) => {
        // Last rung of the glass engine's fallback ladder, if it stepped down during the bench.
        const rung = document.documentElement.dataset.glassRung ?? "none";
        const res = { ...r, rung };
        (window as unknown as { __bench: BenchResult }).__bench = res;
        setBench(res);
      });
    }, 1500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  const themeId = params.get("theme") ?? ACTIVE_THEME_ID;
  return (
    <ThemeProvider initialThemeId={themeId}>
      <Atmosphere layers={benchLayers(params)} />
      <HomeScreen key={params.get("view")} onOpenScenes={() => {}} />
      {bench && (
        <pre
          id="bench"
          style={{
            position: "fixed",
            right: 8,
            bottom: 8,
            zIndex: 999,
            margin: 0,
            padding: 8,
            background: "#000c",
            color: "#fff",
            font: "12px monospace",
          }}
        >
          {JSON.stringify(bench, (_, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v))}
        </pre>
      )}
    </ThemeProvider>
  );
}
