// Kayro performance bench: the test data folder, written from scratch at each session (never a
// copy of anyone's profile). Fixed settings (the art direction's reference look), 15 test apps
// whose targets do not exist (a stray click launches nothing), one test scene.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, ROOT } from "./lib.mjs";

/** Settings of every session (schema v2). Only `quality` changes between blocks. */
export const SETTINGS = {
  schemaVersion: 2,
  themeId: "lavande-peche",
  quality: "high",
  colorMode: "light",
  hotkey: "Ctrl+Alt+H",
  language: "fr",
  atmosphereIntensity: 1.0,
  displayMode: "immersive",
  widgetStyle: "brume",
  hideOnEscape: true,
  hideOnBlur: false,
  economyMode: false,
  motionStyle: "lively",
  followSystemMotion: true,
  cardFloat: "visible",
  openingStyle: "pulse",
  themeTransition: "wave",
  widgetUnroll: "unroll",
  widgetSpring: "normal",
  cardHover: "full",
  bokeh: true,
  particles: true,
  cursorLight: true,
};

const CATEGORIES = {
  jeux: ["Aube de cendre", "Nuit polaire", "Les Sept Tours", "Orbite", "Marée basse", "Forge"],
  stream: ["Studio", "Salon vidéo", "Radio du soir", "Clips"],
  creativite: [], // empty on purpose: the « catégorie vide » case
  logiciels: ["Carnet", "Tableur", "Atelier photo"],
  autres: ["Outils", "Archives"],
};

const json = (o) => JSON.stringify(o, null, 2);

/** Removes and rewrites the whole data folder (logs included). */
/**
 * `screen` (primary screen, from win.ps1): every mode opens there. Without a saved placement the
 * app would open on the screen under the mouse, which may be a slower one.
 */
export function makeData(quality = "high", screen = null) {
  rmSync(DATA, { recursive: true, force: true });
  mkdirSync(join(DATA, "scenes"), { recursive: true });
  const apps = [];
  let n = 0;
  for (const [category, names] of Object.entries(CATEGORIES))
    for (const name of names) {
      const id = "banc-" + String(++n).padStart(2, "0");
      apps.push({
        id,
        name,
        category,
        source: { kind: "manual" },
        // Absolute (the app refuses anything else) and never created.
        launch: { kind: "lnk", path: join(ROOT, "absent", id + ".lnk") },
        match: { exe: null },
        art: { poster: null, hero: null },
        moodId: null,
        favorite: false,
      });
    }
  writeFileSync(join(DATA, "apps.json"), json({ schemaVersion: 1, apps }));
  writeSettings({ quality });
  if (screen) {
    const monitor = {
      name: screen.name,
      rect: { x: screen.x, y: screen.y, width: screen.width, height: screen.height },
    };
    const at = { monitor, rect: null }; // rect null: full screen, or centred on it
    writeFileSync(
      join(DATA, "state.json"),
      json({ schemaVersion: 1, immersive: at, window: at, widget: at, recents: [] }),
    );
  }
  writeFileSync(
    join(DATA, "slots.json"),
    json({ schemaVersion: 1, slots: { musique: "banc-07", jeu: "banc-01", outil: "banc-11" } }),
  );
  const steps = [
    { type: "launch", slot: "musique", required: false },
    { type: "wait", ms: 1000, required: false },
    { type: "launch", slot: "jeu", required: false },
    { type: "launch", slot: "outil", required: false },
  ];
  writeFileSync(
    join(DATA, "scenes", "banc.json"),
    json({ schemaVersion: 1, id: "banc", name: "Banc", steps }),
  );
  return apps.length;
}

/** Rewrites settings.json only (the exe must be closed: it reads it at launch). */
export function writeSettings(patch) {
  writeFileSync(join(DATA, "settings.json"), json({ ...SETTINGS, ...patch }));
}

/** The whole bench folder goes at the end of a session (only the results are kept). */
export function removeData() {
  rmSync(join(ROOT, "appdata"), { recursive: true, force: true });
}
