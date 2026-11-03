// Development page for the home screen (step 7): `/dev/home`, dev builds only (see main.tsx).
// It fills the store with fake apps, so the screen can be checked in a plain browser:
//   ?theme=<theme id> (default: the art direction's)   ?apps=60 (all in "jeux")   ?empty=1   ?view=grid
//   ?fx=eco|balanced|high|ultra (quality, default high)   ?intensity=0.3…1
//   ?addmock=1 (fake core for the add / edit dialogs: detected apps, drop, add, edit, remove)
//   ?cycle=ms (clicks the next category tab every ms: watch the glass selection pill slide)
//   ?opening=1 (the opening above the home screen)   ?seek=ms (one moment of it, still)
//   ?loop=ms (plays the opening again every ms)   ?fan=1 (round 3b: start on the category fan)
//   ?seq=link|tab|back&seek=ms (one moment of a category sequence, still)
//   ?loop=ms&seq=link|tab|back (that sequence again every ms; link starts on the fan)
//   ?fan=1&hover=i (card i of the fan hovered: lift, threads, sparks)
//   ?colors=light|immersive (step 14: fake palettes for the games, the tide between them)
import { useEffect, useRef, useState } from "react";
import { QUALITIES, ThemeProvider, applyQuality } from "../design";
import { Atmosphere } from "../fx";
import { GameAtmosphere } from "../features/gameColors/GameAtmosphere";
import { installGameColorsMock } from "./gameColorsMock";
import { HomeScreen } from "../features/home/HomeScreen";
import type { AppEntry } from "../ipc/bindings";
import { ipc } from "../ipc/commands";
import { hubStore } from "../store";
import { installAddAppsMock } from "./addAppsMock";
import { Opening } from "../features/opening/Opening";
import { ACTIVE_THEME_ID } from "../design/da";
import type { CategoryId } from "../features/home/categories";
import { SOUND_DEFAULTS, UPDATE_DEFAULTS, VISUAL_DEFAULTS, DETECT_DEFAULTS } from "../features/settings/settingsModel";
import { effectiveQuality } from "../design/quality";

/** The category journey, as exposed by useCategoryLink.ts in development builds. */
interface LinkDev {
  pick: (cat: CategoryId, seek?: number) => void;
  tab: (cat: CategoryId, seek?: number) => void;
  back: (seek?: number) => void;
  mode: () => "fan" | "home";
  fan: () => void;
  home: () => void;
  hover: (i: number) => void;
}
const linkDev = () => (window as unknown as { __categoryLink?: LinkDev }).__categoryLink;
const CATS: CategoryId[] = ["jeux", "stream", "creativite", "logiciels", "autres"];

/** Category sequences on demand (round 3b): still moments and loops. */
function useCategoryDev(params: URLSearchParams): void {
  useEffect(() => {
    const seq = params.get("seq");
    const seek = params.has("seek") ? Number(params.get("seek")) : undefined;
    const loop = Number(params.get("loop"));
    const timers: number[] = [];
    let n = 0;
    const step = () => {
      const l = linkDev();
      if (!l) return;
      const cat = CATS[n++ % CATS.length]!;
      if (seq === "tab") l.tab(CATS[n % CATS.length]!);
      else if (seq === "back") {
        if (l.mode() === "fan") l.home();
        else l.back();
      } else if (l.mode() === "fan") l.pick(cat);
      else l.fan();
    };
    // ?hover=i: card i of the fan stays hovered (threads, sparks).
    const hover = params.has("hover") ? Number(params.get("hover")) : -1;
    if (hover >= 0) timers.push(window.setTimeout(() => linkDev()?.hover(hover), 900));
    if (seq && seek !== undefined) {
      timers.push(
        window.setTimeout(() => {
          const l = linkDev();
          if (seq === "link") l?.pick("jeux", seek);
          else if (seq === "tab") l?.tab("stream", seek);
          else l?.back(seek);
        }, 800),
      );
    } else if (loop > 0 && (params.has("fan") || seq)) {
      timers.push(window.setInterval(step, loop));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const MOCK: Record<string, string[]> = {
  jeux: ["Riot Client", "Minecraft", "Steam", "Epic Games", "Battle.net"],
  stream: ["Streamlabs", "Twitch", "OBS Studio", "Discord", "Spotify"],
  creativite: ["Krita", "DaVinci Resolve", "Blender", "Figma", "Ableton Live"],
  logiciels: ["Terminal", "Firefox", "VS Code", "Notion", "7-Zip"],
  autres: ["Photos", "Bloc-notes", "Paramètres", "Calculatrice", "Musique"],
};

/** `?mood=runes`: every app takes that ambience (steps 16–17, needs `?colors`). */
const DEV_MOOD = new URLSearchParams(location.search).get("mood");

function entry(name: string, category: string, i: number): AppEntry {
  return {
    id: `${category}-${i}`,
    name,
    category,
    source: { kind: "manual" },
    launch: { kind: "exe", path: "C:/fake.exe", args: [], cwd: null, elevated: false },
    match: { exe: null },
    art: { poster: null, hero: null },
    moodId: DEV_MOOD,
    favorite: false,
  };
}

function seed(params: URLSearchParams): AppEntry[] {
  if (params.has("empty")) return [];
  const n = Number(params.get("apps"));
  if (n > 0) return Array.from({ length: n }, (_, i) => entry(`Application ${i + 1}`, "jeux", i));
  return Object.entries(MOCK).flatMap(([cat, names]) => names.map((nm, i) => entry(nm, cat, i)));
}

export default function HomeDev() {
  const params = new URLSearchParams(location.search);
  const [opening, setOpening] = useState({ on: params.has("opening"), run: 0 });
  const under = useRef<HTMLDivElement>(null);
  const seek = params.has("seek") && params.has("opening") ? Number(params.get("seek")) : null;
  useCategoryDev(params);
  const [ready] = useState(() => {
    const apps = seed(params);
    hubStore.setState({
      status: "ready",
      apps,
      settings: {
        ...VISUAL_DEFAULTS,
        ...SOUND_DEFAULTS,
        ...UPDATE_DEFAULTS,
        ...DETECT_DEFAULTS,
        openingScreen: "last",
        schemaVersion: 2,
        themeId: params.get("theme") ?? ACTIVE_THEME_ID,
        quality: QUALITIES.find((q) => q === params.get("fx")) ?? "high",
        colorMode: "light",
        hotkey: "Ctrl+Alt+H",
        language: "fr",
        atmosphereIntensity: Number(params.get("intensity")) || 1,
        displayMode: "immersive",
        islandAlways: true,
        islandTuck: false,
        islandTuckDelay: 1.5,
        islandPeekDelay: 0.1,
        islandMusic: false,
        musicBass: 1,
        musicCrash: 1,
        musicTrails: 0.6,
        musicGloss: 0,
        musicSenseKick: 1,
        musicSenseSnare: 1,
        musicSenseHat: 1,
        musicSenseCrash: 1,
        musicDelayMs: 0,
        musicQuality: "auto",
        musicDemo: false,
        musicColors: "cover",
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
    if (params.has("colors")) installGameColorsMock(apps);
    applyQuality(effectiveQuality(hubStore.getState().settings?.quality ?? "high"));
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
    if (!params.has("opening")) return;
    const replay = () => setOpening((o) => ({ on: true, run: o.run + 1 }));
    const loop = params.has("fan") ? 0 : Number(params.get("loop"));
    const id = loop > 0 ? window.setInterval(replay, loop) : 0;
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  const themeId = params.get("theme") ?? ACTIVE_THEME_ID;
  return (
    <ThemeProvider initialThemeId={themeId}>
      {params.has("colors") ? <GameAtmosphere /> : <Atmosphere />}
      <div ref={under} style={{ height: "100%" }}>
        <HomeScreen
          key={params.get("view")}
          onOpenScenes={() => {}}
          startOnFan={params.has("fan") || params.get("seq") === "link"}
        />
      </div>
      {opening.on && (
        <Opening
          key={opening.run}
          under={under}
          seek={seek}
          onDone={() => setOpening((o) => ({ ...o, on: false }))}
        />
      )}
    </ThemeProvider>
  );
}
