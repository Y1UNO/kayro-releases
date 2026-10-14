import { describe, expect, it } from "vitest";
import { BUILTIN_THEMES } from "../../design";
import { worstContrast } from "../../design/contrast";
import type { Palette } from "../../ipc/bindings";
import { chromaOf, hexToLab, hexToRgb, labToHex, rgbToLab } from "../../lib/oklab";
import {
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

  it("stay within the themes' lightness, with a night only in immersive", () => {
    for (const theme of BUILTIN_THEMES) {
      for (const p of Object.values(EXTREMES)) {
        const light = deriveGameColors(theme, { main: p, other: null }, "light")!;
        expect(light.night).toBeNull();
        // Never darker than the theme's own darkest gradient colour (Sakura and Cuivre's B < 0.72).
        const floor = Math.min(0.72, ...theme.gradient!.map((h) => hexToLab(h)[0])) - 0.01;
        for (const hex of [light.a, light.b]) {
          const [L] = hexToLab(hex);
          expect(L).toBeGreaterThan(floor);
          expect(L).toBeLessThan(0.9);
        }
        const deep = deriveGameColors(theme, { main: p, other: null }, "immersive")!;
        for (const hex of deep.night!) expect(hexToLab(hex)[0]).toBeLessThan(0.26);
      }
    }
  });

  it("keep every text pair at 4.5:1 or more, on all 6 themes", () => {
    for (const theme of BUILTIN_THEMES) {
      for (const [name, p] of Object.entries(EXTREMES)) {
        for (const mode of ["light", "immersive"] as const) {
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
});
