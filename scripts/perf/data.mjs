// Kayro performance bench: the test data folder, written from scratch at each session (never a
// copy of anyone's profile). Fixed settings (the art direction's reference look), 15 test apps
// whose targets do not exist (a stray click launches nothing), one test scene.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, ROOT } from "./lib.mjs";
import { png } from "./png.mjs";

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

/** Settings every case starts from (bench.mjs), then its own `settings` on top. */
export const BASE_LOOK = {
  cardFloat: "visible",
  particles: true,
  themeId: "lavande-peche",
  colorMode: "light", // step 14: a G case may set « immersive »; the next ones get « light » back
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
export function makeData(quality = "high", screen = null, art = false) {
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
  if (art) makeArt(apps.filter((a) => a.category === ART_CATEGORY));
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

/** Step 14 (G cases): the apps of this tab get generated pictures (never a game's art). */
export const ART_CATEGORY = "stream";

/** Colours of the generated pictures: dominant, accent (hues as different as real posters). */
const ART_COLOURS = [
  [
    [29, 52, 47],
    [137, 176, 142],
  ],
  [
    [88, 31, 33],
    [249, 203, 128],
  ],
  [
    [23, 30, 53],
    [103, 182, 194],
  ],
  [
    [86, 49, 71],
    [187, 115, 111],
  ],
];

/** G cases need the pictures: `--art`, or any case whose id starts with G. */
export function wantsArt(args) {
  const ids = String(args.cases ?? "")
    .toUpperCase()
    .split(",");
  return Boolean(args.art) || ids.some((c) => c.trim().startsWith("G"));
}

const lerp = (p, q, t) => p.map((v, i) => Math.round(v + (q[i] - v) * t));

/** Poster 300 × 450, hero 960 × 310 and logo 400 × 140 per app, in the user's art folder. */
function makeArt(apps) {
  apps.forEach((app, i) => {
    const [dom, acc] = ART_COLOURS[i % ART_COLOURS.length];
    const dir = join(DATA, "art", app.id);
    mkdirSync(dir, { recursive: true });
    const band = (x, y, w, h) => Math.max(0, 1 - Math.abs(x / w - y / h - 0.1) * 6);
    const poster = (x, y) => [
      ...lerp(lerp(dom, [0, 0, 0], y / 600), acc, band(x, y, 300, 450) * 0.8),
      255,
    ];
    const hero = (x, y) => [
      ...lerp(dom, acc, Math.max(0, 1 - Math.hypot(x / 960 - 0.6, y / 310 - 0.4) * 2) * 0.7),
      255,
    ];
    const logo = (x, y) => {
      const inside = Math.hypot((x - 200) / 190, (y - 70) / 60) < 1;
      return inside ? [...lerp(acc, [255, 255, 255], 0.3), 230] : [0, 0, 0, 0];
    };
    writeFileSync(join(dir, "poster.png"), png(300, 450, poster));
    writeFileSync(join(dir, "hero.png"), png(960, 310, hero));
    writeFileSync(join(dir, "logo.png"), png(400, 140, logo));
  });
}

/** Rewrites settings.json only (the exe must be closed: it reads it at launch). */
export function writeSettings(patch) {
  writeFileSync(join(DATA, "settings.json"), json({ ...SETTINGS, ...patch }));
}

/** The whole bench folder goes at the end of a session (only the results are kept). */
export function removeData() {
  rmSync(join(ROOT, "appdata"), { recursive: true, force: true });
}
