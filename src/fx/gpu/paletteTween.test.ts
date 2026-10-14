import { describe, expect, it } from "vitest";
import { GAME_COLORS, tideRadius, tideReach, tideReachPx } from "../../design/motion/tokens14";
import type { FxPalette } from "../FxLayer";
import { PaletteTween } from "./paletteTween";

const theme: FxPalette = {
  beam: [114, 130, 188],
  fog: ["", "", ""],
  a: [163, 176, 222],
  b: [114, 130, 188],
  card: [163, 176, 222],
  bg: ["#141a30", "#0b0f1e", "#05070f"],
};
const game: FxPalette = { ...theme, a: [200, 40, 40], b: [40, 70, 210], card: [200, 40, 40] };
const W = 1600;
const H = 900;
const card = { x: 800, top: 300, bottom: 600 };
const MS = GAME_COLORS.tide.ms;

function started(passage: FxPalette["passage"] = "tide", reduced = false): PaletteTween {
  const t = new PaletteTween();
  t.set(theme, W, H, 1, false, 0);
  t.focus(card);
  t.set({ ...game, passage }, W, H, 1, reduced, 1000);
  return t;
}

describe("palette tide", () => {
  it("spreads from the selected card and ends with the new palette everywhere", () => {
    const t = started();
    expect(t.running).toBe(true);
    t.step(1000 + MS * 0.3);
    expect(t.weight(800, 450)).toBe(1);
    expect(t.weight(0, 0)).toBe(0);
    expect(t.step(1000 + MS)).toBe(true);
    expect(t.running).toBe(false);
    expect(t.weight(0, 0)).toBe(1);
    expect(t.fromColours()).toBeNull();
  });

  it("does not play for the same colours, an instant change or reduced motion", () => {
    expect(started("instant").running).toBe(false);
    expect(started("tide", true).running).toBe(false);
    const same = new PaletteTween();
    same.set(theme, W, H, 1, false, 0);
    same.focus(card);
    same.set({ ...theme, passage: "tide" }, W, H, 1, false, 10);
    expect(same.running).toBe(false);
  });

  it("tints the glass: cards by their shade, pills paler, the rest untouched", () => {
    const t = started();
    t.step(1000 + MS * 0.3);
    const inside = t.tint("card", [0.5, 0.5, 0.5], 800, 450);
    expect(inside[0]).toBeCloseTo((200 / 255) * 0.5, 5);
    const outside = t.tint("card", [1, 1, 1], 0, 0);
    expect(outside[0]).toBeCloseTo(163 / 255, 5);
    const pill = t.tint("pill", [1, 1, 1], 800, 450);
    expect(pill[0]).toBeCloseTo(0.75 + 0.25 * (200 / 255), 5);
    expect(t.tint("bar", [0.1, 0.2, 0.3], 800, 450)).toEqual([0.1, 0.2, 0.3]);
  });

  it("gives the shader the old palette and the tide, and nothing to mix once it is over", () => {
    const t = started();
    t.step(1000 + MS / 2);
    const u = t.uniforms();
    expect(u.uA0).toEqual([163 / 255, 176 / 255, 222 / 255]);
    const tide = u.uTide as number[];
    expect(tide[0]).toBe(800);
    expect(tide[1]).toBe(450);
    expect(tide[3]).toBeCloseTo(GAME_COLORS.tide.band, 5);
    t.step(1000 + MS);
    expect((t.uniforms().uTide as number[])[2]).toBeGreaterThan(1e5);
  });
});

describe("tide timing", () => {
  it("finds when the edge reaches a distance (the curve inverted)", () => {
    const reach = tideReachPx(800, 450, W, H);
    for (const d of [50, 300, 700]) {
      const at = tideReach(d, MS, reach);
      expect(tideRadius(at, MS, reach)).toBeCloseTo(d, 0);
    }
    expect(tideReach(0, MS, reach)).toBe(0);
    expect(tideReach(reach * 2, MS, reach)).toBe(MS);
  });
});
