import { describe, expect, it } from "vitest";
import { BUILTIN_THEMES } from "../../design";
import { worstContrast } from "../../design/contrast";
import type { Palette } from "../../ipc/bindings";
import { chromaOf, hexToLab, hexToRgb, hueGap, labToHex, rgbToLab } from "../../lib/oklab";
import {
  characterOf,
  mixLch,
  deriveGameColors,
  faceColors,
  gamePair,
  gamePalette,
  withGameColors,
  type GameSource,
} from "./derive";

/** A palette as the core gives it: colours largest share first, roles by index. */
function palette(hexes: string[], roles: Partial<Omit<Palette, "colors">> = {}): Palette {
  const n = hexes.length;
  return {
    colors: hexes.map((hex, i) => {
      const [l, a, b] = rgbToLab(hexToRgb(hex));
      return { l, a, b, weight: (n - i) / ((n * (n + 1)) / 2), hex };
    }),
    dominant: 0,
    accent: n > 1 ? 1 : 0,
    dark: 0,
    light: 0,
    ...roles,
  };
}

const EXTREMES: Record<string, Palette> = {
  black: palette(["#000000", "#050505"]),
  white: palette(["#ffffff", "#f4f4f4"]),
  grey: palette(["#808080"]),
  neonGreen: palette(["#00ff3c", "#ff00e1"]),
  neonBlue: palette(["#0011ff", "#fff200"]),
  hades: palette(["#1d342f", "#89b08e", "#070d12"]),
  overwatch: palette(["#581f21", "#f9cb80"]),
};

describe("game colours", () => {
  it("follow the theme when off or without a palette", () => {
    const theme = BUILTIN_THEMES[0]!;
    const src: GameSource = { main: EXTREMES.hades!, other: null };
    expect(deriveGameColors(theme, src, "off")).toBeNull();
    expect(deriveGameColors(theme, null, "light")).toBeNull();
    const fx = gamePalette(theme, null, { hero: null, passage: "instant" });
    expect(fx.bg).toEqual(theme.bg);
    expect(fx.card).toEqual(theme.card);
  });

  it("stay within the themes' lightness, with a lighter-handed night in « Léger »", () => {
    for (const theme of BUILTIN_THEMES) {
      for (const p of Object.values(EXTREMES)) {
        const light = deriveGameColors(theme, { main: p, other: null }, "light")!;
        for (const hex of light.night!) expect(hexToLab(hex)[0]).toBeLessThan(0.26);
        // Never darker than the theme's own darkest gradient colour (Sakura and Cuivre's B < 0.72).
        const floor = Math.min(0.72, ...theme.gradient!.map((h) => hexToLab(h)[0])) - 0.01;
        for (const hex of [light.a, light.b]) {
          const [L] = hexToLab(hex);
          expect(L).toBeGreaterThan(floor);
          expect(L).toBeLessThan(0.9);
        }
        for (const hex of light.night!) expect(hexToLab(hex)[0]).toBeLessThan(0.26);
      }
    }
  });

  it("keep every text pair at 4.5:1 or more, on all 6 themes", () => {
    for (const theme of BUILTIN_THEMES) {
      for (const [name, p] of Object.entries(EXTREMES)) {
        for (const mode of ["light"] as const) {
          const c = deriveGameColors(theme, { main: p, other: null }, mode)!;
          const worst = worstContrast(withGameColors(theme, c));
          expect(
            worst.ratio,
            `${theme.id} · ${name} · ${mode} · ${worst.name}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("take a one-colour image's accent from the game's other image, else from the theme", () => {
    const themeB = hexToLab("#7282bc");
    const flat = palette(["#56afff"]);
    const poster = palette(["#58affe", "#f4ea2d"]);
    const [, fromOther] = gamePair({ main: flat, other: poster }, themeB, "dominant");
    expect(labToHex(fromOther)).toBe("#f4ea2d");
    const [, fromTheme] = gamePair({ main: flat, other: null }, themeB, "dominant");
    expect(labToHex(fromTheme)).toBe("#7282bc");
  });

  it("mix more of the game as the intensity rises", () => {
    const theme = BUILTIN_THEMES[0]!;
    const src = { main: EXTREMES.overwatch!, other: null };
    const gap = (i: "soft" | "normal" | "strong") => {
      const c = deriveGameColors(theme, src, "light", {
        intensity: i,
        character: "theme",
        pick: "dominant",
      })!;
      const [ta] = theme.gradient!.map(hexToLab);
      const a = hexToLab(c.a);
      return Math.hypot(a[0] - ta![0], a[1] - ta![1], a[2] - ta![2]);
    };
    expect(gap("soft")).toBeLessThan(gap("normal"));
    expect(gap("normal")).toBeLessThan(gap("strong"));
  });

  it("give cards without a picture their icon's colours, bounded like a game's", () => {
    const theme = BUILTIN_THEMES[0]!;
    const [a, b] = faceColors(theme, palette(["#fe98a4", "#b2dfe9"]))!;
    expect(chromaOf(hexToLab(a))).toBeLessThan(0.13);
    expect(a).not.toBe(b);
  });

  it("follow the app's own choice: its two colours, or the theme's", () => {
    const theme = BUILTIN_THEMES[0]!;
    const src = { main: EXTREMES.hades!, other: null };
    expect(deriveGameColors(theme, src, "light", undefined, { mode: "theme" })).toBeNull();
    const own = { mode: "chosen" as const, a: "#c82828", b: "#2846d2" };
    const chosen = deriveGameColors(theme, null, "light", undefined, own)!;
    const auto = deriveGameColors(theme, src, "light")!;
    expect(chosen.a).not.toBe(auto.a);
    // Bounded and mixed like the automatic colours: red stays red-ish, never the raw #c82828.
    expect(chosen.a).not.toBe("#c82828");
    expect(hexToLab(chosen.a)[1]).toBeGreaterThan(hexToLab(auto.a)[1]);
    expect(deriveGameColors(theme, src, "light", undefined, { mode: "auto" })).toEqual(auto);
  });

  it("speak for a dark poster with its colour, not its grey sky (review 2026-10-29)", () => {
    const p: Palette = {
      colors: [
        { l: 0.2, a: 0.001, b: 0.002, weight: 0.6, hex: "#1b1b1c" },
        { l: 0.6, a: -0.09, b: -0.05, weight: 0.2, hex: "#2f9fb0" },
        { l: 0.7, a: 0.12, b: 0.08, weight: 0.08, hex: "#e0705a" },
      ],
      dominant: 0,
      accent: 2,
      dark: 0,
      light: 2,
    };
    const c = characterOf(p)!;
    expect(c[1]).toBeCloseTo(-0.09);
  });
});

describe("game colours follow the picture (review 2026-10-29)", () => {
  // Apex Legends' poster on this PC (palettes.json): navy sky, grey, brown, blue, cyan, white.
  const apex: Palette = {
    colors: [
      { l: 0.241, a: -0.005, b: -0.045, weight: 0.42, hex: "#171e35" },
      { l: 0.56, a: -0.02, b: -0.01, weight: 0.17, hex: "#6b7e83" },
      { l: 0.44, a: 0.01, b: 0.02, weight: 0.13, hex: "#524941" },
      { l: 0.4, a: -0.02, b: -0.13, weight: 0.12, hex: "#184792" },
      { l: 0.73, a: -0.07, b: -0.03, weight: 0.1, hex: "#67b6c2" },
      { l: 0.92, a: 0.0, b: 0.0, weight: 0.06, hex: "#e4e6e2" },
    ],
    dominant: 0,
    accent: 4,
    dark: 0,
    light: 5,
  };

  it("a blue game on the peach theme stays blue: no grey from the mix", () => {
    const peach = BUILTIN_THEMES.find((t) => t.id === "lavande-peche")!;
    const c = deriveGameColors(peach, { main: apex, other: null }, "light")!;
    for (const hex of [c.a, c.b]) expect(chromaOf(hexToLab(hex))).toBeGreaterThan(0.06);
    expect(hexToLab(c.a)[2]).toBeLessThan(-0.04); // A: the game's blue
    // B: towards its cyan (the theme's peach only bends it a little round the circle).
    expect(hueGap(hexToLab(c.b), hexToLab("#67b6c2"))).toBeLessThan(30);
  });

  it("mixLch keeps the chroma between two far hues", () => {
    const m = mixLch([0.8, 0.1, 0], [0.8, -0.1, 0], 0.5);
    expect(chromaOf(m)).toBeCloseTo(0.1, 3);
  });
});
