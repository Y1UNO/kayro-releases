// Builds data.js for the step-14 board: the 6 real themes (src/design/themes) and, for the Steam
// games installed on this PC, the paths of their images in Steam's own cache (read in place, never
// copied) with the palettes Kayro takes from them (src-tauri example `palette_dump`).
// Local only: data.js and this folder are never committed. Run: node reference/planches-14/make-data.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const GAMES = [
  ["1145350", "Hades II"],
  ["960090", "Bloons TD 6"],
  ["2357570", "Overwatch"],
  ["1903340", "Clair Obscur : Expedition 33"],
  ["1172470", "Apex Legends"],
  ["2483190", "Forza Horizon 6"],
  ["3357650", "PRAGMATA"],
  ["2902720", "SPAM"],
];
const iconsDir = join(process.env.APPDATA, "Kayro", "cache", "icons");
const iconFile = readdirSync(iconsDir).find((f) => f.startsWith("crystaldiskinfo"));
const NO_IMAGE = iconFile
  ? { name: "CrystalDiskInfo", file: join(iconsDir, iconFile) }
  : null;

const args = GAMES.map(([id]) => `steam:${id}`);
if (NO_IMAGE) args.push(`file:${NO_IMAGE.file}`);
const raw = execFileSync(
  "cargo",
  ["run", "-q", "-p", "hub", "--release", "--example", "palette_dump", "--", ...args],
  { cwd: root, encoding: "utf8", shell: false },
);
const dumped = JSON.parse(raw);
// Two addresses per image: file:// (board opened from the disk) and the local server's (serve.mjs).
const served = (path) => {
  const steam = path.split(/librarycache[\\/]/i)[1];
  if (steam) return `/steam/${steam.replaceAll("\\", "/")}`;
  return `/icons/${path.split(/[\\/]/).pop()}`;
};
const url = (img) =>
  img ? { ...img, url: pathToFileURL(img.path).href, http: served(img.path), path: undefined } : null;

const games = GAMES.map(([id, name], i) => {
  const { images } = dumped[i];
  return {
    id: `steam-${id}`,
    name,
    poster: url(images.poster),
    hero: url(images.hero),
    heroBlur: url(images["hero-blur"]),
    logo: url(images.logo),
  };
}).filter((g) => g.poster);
const noImage = NO_IMAGE
  ? { id: "crystaldiskinfo", name: NO_IMAGE.name, icon: url(dumped.at(-1).images.icon) }
  : null;

const themesDir = join(root, "src", "design", "themes");
const order = ["bleu-gris", "lavande-peche", "encre", "sakura", "opale", "cuivre"];
const themes = order.map((id) => JSON.parse(readFileSync(join(themesDir, `${id}.json`), "utf8")));

const data = { generated: new Date().toISOString(), themes, games, noImage };
writeFileSync(join(here, "data.js"), `window.PLANCHE = ${JSON.stringify(data, null, 1)};\n`);
console.log(`data.js : ${games.length} jeux, ${themes.length} thèmes, sans image : ${noImage?.name ?? "aucun"}`);
