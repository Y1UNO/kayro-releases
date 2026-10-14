// Development only (`/dev/home?colors=light|immersive`): fake palettes for the first games, with
// the colours the step-14 board measured on real Steam posters, so the tide can be checked in a
// plain browser (no core, no picture).
import type { AppEntry, AppPalette, Palette } from "../ipc/bindings";
import { artStore } from "../store";
import { hexToRgb, rgbToLab } from "../lib/oklab";

const GAMES: [string, string][] = [
  ["#1d342f", "#89b08e"], // Hades II
  ["#bfe5ee", "#c85e39"], // Bloons TD 6
  ["#581f21", "#f9cb80"], // Overwatch
  ["#171e35", "#67b6c2"], // Apex Legends
  ["#563147", "#bb736f"], // SPAM
  ["#c0bac0", "#c45b64"], // Forza Horizon 6
];

function palette([dom, acc]: [string, string]): Palette {
  const color = (hex: string, weight: number) => {
    const [l, a, b] = rgbToLab(hexToRgb(hex));
    return { l, a, b, weight, hex };
  };
  return { colors: [color(dom, 0.7), color(acc, 0.3)], dominant: 0, accent: 1, dark: 0, light: 1 };
}

export function installGameColorsMock(apps: AppEntry[]): void {
  const games = apps.filter((a) => a.category === "jeux");
  const palettes: Record<string, AppPalette[]> = {};
  games.forEach((app, i) => {
    const pair = GAMES[i % GAMES.length]!;
    palettes[app.id] = [{ id: app.id, source: "poster", palette: palette(pair) }];
  });
  artStore.setState({ palettes });
}
