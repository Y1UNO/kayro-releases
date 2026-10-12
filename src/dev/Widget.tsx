// Development page of the widget (art direction round 4b): `/dev/widget`, dev builds only (see
// main.tsx). The real widget page (bar + panel whose glass unrolls) with fake apps, scenes and
// recents, over a fake desktop drawn in CSS (dev only), so it can be tried in a plain browser and
// in the workshop. Texts are not translated on purpose (dev page).
//   ?theme=<id>   ?fx=eco|balanced|high|ultra
//   ?atelier=A|B (workshop preview)   ?open=1 (opens once at load)   ?cycle=ms (opens / folds)
import { useEffect, useState } from "react";
import { QUALITIES, ThemeProvider } from "../design";
import { ACTIVE_THEME_ID } from "../design/da";
import { WidgetApp } from "../features/widget/WidgetApp";
import type { AppEntry, SceneFile } from "../ipc/bindings";
import { desktopStore, hubStore, sceneStore } from "../store";
import styles from "./Widget.module.css";
import { VISUAL_DEFAULTS } from "../features/settings/settingsModel";

const NAMES = ["Valorant", "Discord", "Spotify", "OBS Studio", "Steam", "Minecraft", "Blender"];
const APPS: AppEntry[] = NAMES.map((name, i) => ({
  id: `w-${i}`,
  name,
  category: i < 2 ? "jeux" : "logiciels",
  source: { kind: "manual" },
  launch: { kind: "exe", path: "C:/fake.exe", args: [], cwd: null, elevated: false },
  match: { exe: null },
  art: { poster: null, hero: null },
  moodId: null,
  favorite: false,
}));
const SCENES: SceneFile[] = ["Soirée gaming", "Stream", "Travail"].map((name, i) => ({
  schemaVersion: 1,
  id: `scene-${i}`,
  name,
  steps: [{ type: "launch", slot: "a" }],
}));

function install(params: URLSearchParams): true {
  document.documentElement.dataset.window = "widget";
  hubStore.setState({
    status: "ready",
    apps: APPS,
    running: {
      "w-1": { id: "w-1", running: true, foreground: false },
      "w-2": { id: "w-2", running: true, foreground: true },
    },
    settings: {
      ...VISUAL_DEFAULTS,
      schemaVersion: 2,
      themeId: params.get("theme") ?? ACTIVE_THEME_ID,
      quality: QUALITIES.find((q) => q === params.get("fx")) ?? "high",
      colorMode: "light",
      hotkey: "Ctrl+Alt+H",
      language: "fr",
      atmosphereIntensity: 1,
      displayMode: "widget",
      widgetStyle: "brume", // ignored since round 5 (the widget follows the theme)
      hideOnEscape: true,
      hideOnBlur: false,
      economyMode: false,
    },
  });
  sceneStore.setState({ loaded: true, scenes: SCENES, run: null });
  desktopStore.setState({ recents: ["w-0", "w-3", "w-4", "w-5"] });
  return true;
}

const toggle = () =>
  document.querySelector<HTMLButtonElement>("header button[aria-expanded]")?.click();

export default function WidgetDev() {
  const params = new URLSearchParams(location.search);
  useState(() => install(params)); // once, before the first render

  useEffect(() => {
    if (params.get("open") === "1") window.setTimeout(toggle, 600);
    const every = Number(params.get("cycle"));
    if (!(every > 0)) return;
    const id = window.setInterval(toggle, every);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.desktop}>
      <div className={styles.window}>
        <ThemeProvider initialThemeId={hubStore.getState().settings?.themeId}>
          <WidgetApp />
        </ThemeProvider>
      </div>
      <p className={styles.note}>
        Faux bureau (page de dev). Chevron, onglet ou recherche : déplier · Échap ou clic ailleurs :
        replier.
      </p>
    </div>
  );
}
