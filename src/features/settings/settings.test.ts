import { describe, expect, it } from "vitest";
import { THEME_SWAP } from "../../design/motion/tokens5";
import type { Settings } from "../../ipc/bindings";
import { closeSteps, foldMs, openSteps } from "./advancedUnroll";
import {
  ATMOSPHERE,
  atmosphereLevel,
  isVisualDefault,
  VISUAL_DEFAULTS as V,
  visualSnapshot,
} from "./settingsModel";
import { cardKeyframes, farthestCorner, sparks, swapWay, waveGeometry } from "./themeSwap";

const SETTINGS: Settings = {
  ...V,
  schemaVersion: 2,
  themeId: "bleu-gris",
  colorMode: "light",
  hotkey: "Ctrl+Alt+H",
  language: "fr",
  displayMode: "immersive",
  widgetStyle: "brume",
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
      quality: "balanced",
      atmosphereIntensity: 1,
      motionStyle: "lively",
      cardFloat: "visible",
      openingStyle: "pulse",
      themeTransition: "wave",
    });
  });
});

describe("« Personnalisation avancée » drop-down", () => {
  it("unrolls on the widget's springs, rows 45 ms apart, a halo but in Eco", () => {
    const steps = openSteps(3, 120, false);
    const inner = steps.find((s) => s.target === "inner")!;
    expect(inner.options.duration).toBe(680);
    expect(String(inner.options.easing)).toMatch(/^linear\(/);
    const rows = steps.filter((s) => typeof s.target === "object" && s.options.duration === 520);
    expect(rows.map((s) => s.options.delay)).toEqual([50, 95, 140]);
    expect(steps.some((s) => s.target === "halo")).toBe(true);
    expect(openSteps(3, 120, true).some((s) => s.target === "halo")).toBe(false);
    expect(steps.find((s) => s.target === "below")?.keyframes[0]).toEqual({
      transform: "translateY(-120px)",
    });
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
