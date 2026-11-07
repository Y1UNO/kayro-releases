import { describe, expect, it } from "vitest";
import { THEME_SWAP } from "../../design/motion/tokens5";
import type { Settings } from "../../ipc/bindings";
import { closeSteps, foldMs, openSteps, revealScroll } from "./advancedUnroll";
import {
  ATMOSPHERE,
  atmosphereLevel,
  isVisualDefault,
  SOUND_DEFAULTS,
  UPDATE_DEFAULTS,
  DETECT_DEFAULTS,
  VISUAL_DEFAULTS as V,
  visualSnapshot,
} from "./settingsModel";
import {
  cardKeyframes,
  easing,
  farthestCorner,
  sparks,
  swapWay,
  waveBandFrames,
  waveGeometry,
} from "./themeSwap";

const SETTINGS: Settings = {
  ...V,
  ...SOUND_DEFAULTS,
  ...UPDATE_DEFAULTS,
  ...DETECT_DEFAULTS,
  openingScreen: "last",
  schemaVersion: 2,
  themeId: "bleu-gris",
  colorMode: "light",
  hotkey: "Ctrl+Alt+H",
  searchHotkey: "Ctrl+Alt+K",
  keyboardLayout: "auto",
  language: "fr",
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
};

describe("Réglages › Visuel (round 5)", () => {
  it("maps the atmosphere presets, Normale = the validated look", () => {
    expect(ATMOSPHERE).toEqual({ soft: 0.6, normal: 1, strong: 1.3 });
    expect(atmosphereLevel(1)).toBe("normal");
    expect(atmosphereLevel(0.3)).toBe("soft");
    expect(atmosphereLevel(1.3)).toBe("strong");
    expect(atmosphereLevel(null)).toBe("normal");
  });

  it("resets every Visuel choice but the display mode, with an undo", () => {
    const mine: Settings = {
      ...SETTINGS,
      cardFloat: "strong",
      bokeh: false,
      displayMode: "window",
    };
    expect(isVisualDefault(mine)).toBe(false);
    const undo = visualSnapshot(mine);
    expect(undo).toMatchObject({ cardFloat: "strong", bokeh: false });
    expect(undo).not.toHaveProperty("displayMode");
    expect(isVisualDefault({ ...mine, ...V })).toBe(true);
    expect(V).toMatchObject({
      quality: "auto",
      atmosphereIntensity: 1,
      motionStyle: "lively",
      cardFloat: "visible",
      openingStyle: "pulse",
      themeTransition: "wave",
    });
  });
});

describe("« Personnalisation avancée » drop-down", () => {
  it("unrolls on the widget's springs, rows 32 ms apart, a halo but in Eco", () => {
    const steps = openSteps(3, 120, false);
    const inner = steps.find((s) => s.target === "inner")!;
    expect(inner.options.duration).toBe(680);
    expect(String(inner.options.easing)).toMatch(/^linear\(/);
    const rows = steps.filter((s) => typeof s.target === "object" && s.options.duration === 520);
    expect(rows.map((s) => s.options.delay)).toEqual([40, 72, 104]);
    // Review B4: with the 9 rows, the last one lands ~0.14 s after the shell (680 ms), not 0.3 s.
    const nine = openSteps(9, 0, false).filter((s) => typeof s.target === "object");
    const lands = Math.max(...nine.map((s) => s.options.delay + s.options.duration));
    expect(lands).toBe(816);
    expect(steps.some((s) => s.target === "halo")).toBe(true);
    expect(openSteps(3, 120, true).some((s) => s.target === "halo")).toBe(false);
    expect(steps.find((s) => s.target === "below")?.keyframes[0]).toEqual({
      transform: "translateY(-120px)",
    });
  });

  it("« Mouvement : Net »: the same steps on the entrance curve, no spring (review A5)", () => {
    const steps = openSteps(9, 120, false, 1, true);
    expect(steps.length).toBe(openSteps(9, 120, false).length);
    expect(steps.every((s) => !String(s.options.easing).startsWith("linear("))).toBe(true);
  });

  it("scrolls the panel to show what follows, never past its header (review A1)", () => {
    // Measured in the exe at 1707×960: panel 198–815, header at 747, the reset line ends at 1540.
    const at = { viewTop: 198, viewBottom: 815, headTop: 747 };
    expect(revealScroll({ ...at, endBottom: 1540 })).toBe(747 - 198 - 8);
    // Fits once scrolled a little: just enough, the reset line 24 px above the edge.
    expect(revealScroll({ ...at, endBottom: 900 })).toBe(900 + 24 - 815);
    // Already seen: no scroll.
    expect(revealScroll({ ...at, endBottom: 700 })).toBe(0);
  });

  it("folds in 220 ms, no bounce, everything at once", () => {
    const steps = closeSteps(300);
    expect(steps.every((s) => s.options.duration === 220 && s.options.delay === 0)).toBe(true);
    expect(steps.every((s) => !String(s.options.easing).startsWith("linear("))).toBe(true);
    expect(foldMs(2)).toBe(110);
  });
});

describe("theme change (R5-Reglages-Themes §2–4)", () => {
  const base = {
    setting: "wave" as const,
    eco: false,
    reduced: false,
    viewTransitions: true,
    engineFallback: false,
  };

  it("plays the wave, else the fade, else a direct switch", () => {
    expect(swapWay(base)).toEqual({ way: "wave", card: true });
    expect(swapWay({ ...base, eco: true })).toEqual({ way: "fade", card: true });
    expect(swapWay({ ...base, viewTransitions: false }).way).toBe("fade");
    expect(swapWay({ ...base, engineFallback: true }).way).toBe("fade");
    expect(swapWay({ ...base, setting: "fade" }).way).toBe("fade");
    expect(swapWay({ ...base, reduced: true })).toEqual({ way: "direct", card: false });
    expect(swapWay({ ...base, setting: "direct" }).way).toBe("direct");
  });

  it("the card itself rises, is squashed at the impact (380 ms), then settles", () => {
    const k = cardKeyframes();
    expect(k.ms).toBe(720);
    const offsets = k.transform.map((f) => f.offset);
    expect(offsets[1]).toBeCloseTo(260 / 720, 6);
    expect(offsets[2]).toBeCloseTo(THEME_SWAP.impact / 720, 6);
    expect(k.transform[1]!.transform).toBe("translateY(-8px) scale(1.1)");
    expect(k.transform[2]!.transform).toBe("translateY(2px) scale(0.93)");
    expect(k.filter).toHaveLength(4);
  });

  it("« Mouvement : Net »: the card settles and the check pops without overshoot (review A5)", () => {
    expect(easing("liaison", true)).toBe(easing("vive"));
    expect(easing("rebond", true)).toBe(easing("vive"));
    expect(easing("standard", true)).toBe(easing("standard"));
    expect(easing("rebond")).not.toBe(easing("vive"));
    const eases = cardKeyframes(true).transform.map((k) => k.easing);
    expect(eases).not.toContain(easing("liaison"));
  });

  it("the wave's glow stays 40 px on screen as the ring grows (review B1)", () => {
    const frames = waveBandFrames(0.1, 5.5);
    expect(frames.map((f) => f.offset)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    const band = (i: number) => Number(frames[i]!["--wave-band"]);
    // Small at the moon: at most what the 480 px box shows.
    expect(band(0)).toBe(0.2);
    // At the farthest corner (r = 1 100 px): 40 px = 200 × 5.5 × band.
    expect(200 * 5.5 * band(4)).toBeCloseTo(THEME_SWAP.wave.haloPx, 1);
    expect(band(2)).toBeLessThan(band(1));
  });

  it("12 sparks leave the card's edge, 46 to 82 px, within 66 ms", () => {
    const s = sparks(240, 150);
    expect(s).toHaveLength(12);
    for (const p of s) {
      const edge = [p.x, p.x - 240, p.y, p.y - 150].some((d) => Math.abs(d) < 1e-6);
      expect(edge).toBe(true);
      const d = Math.hypot(p.dx, p.dy);
      expect(d).toBeGreaterThanOrEqual(46);
      expect(d).toBeLessThanOrEqual(82);
      expect(p.delay).toBeGreaterThanOrEqual(0);
      expect(p.delay).toBeLessThanOrEqual(66);
    }
  });

  it("reveals from the moon to the farthest corner, the wave on the circle's edge", () => {
    expect(farthestCorner(100, 100, 1000, 500)).toBeCloseTo(Math.hypot(900, 400), 6);
    const g = waveGeometry(100, 100, 11, { w: 1000, h: 500 });
    expect(g.clip[0]).toBe("circle(11px at 100px 100px)");
    expect(g.scale[0]).toBeCloseTo(11 / 200, 6);
    expect(g.scale[1] * 200).toBeCloseTo(g.r1, 6);
  });
});
