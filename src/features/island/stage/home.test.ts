import { describe, expect, it } from "vitest";
import {
  LIFT,
  SHOULDER,
  homeBounds,
  homeBox,
  homeCentre,
  outline,
  sample,
  wetMask,
  type Home,
} from "./home";

const middle: Home = { x: 960, y: 0, w: 228, h: 32, docked: true, corner: 0 };

describe("Music mode: the island at home", () => {
  it("is centred on its anchor in the middle, flush with its side in a corner", () => {
    expect(homeBox(middle)).toEqual({ x0: 846, y0: 0, x1: 1074, y1: 32 });
    // Slot anchors put a 184 px island flush with the side; wider, it stays flush.
    const left = homeBox({ ...middle, x: 92, corner: -1 });
    expect(left.x0).toBeCloseTo(0);
    const right = homeBox({ ...middle, x: 1920 - 92, corner: 1 });
    expect(right.x1).toBeCloseTo(1920);
    expect(homeCentre(middle)).toEqual({ x: 960, y: 16 });
  });

  it("holds its shoulders in its bounds when docked, not when floating", () => {
    expect(homeBounds(middle).x0).toBe(846 - SHOULDER);
    expect(homeBounds(middle).y0).toBe(-LIFT);
    const floating = { ...middle, docked: false, h: 44 };
    expect(homeBounds(floating)).toEqual(homeBox(floating));
  });

  it("samples its outline evenly, clockwise from its right middle", () => {
    const pts = sample(outline(middle), 96);
    expect(pts.xs).toHaveLength(96);
    expect(pts.xs[0]).toBeCloseTo(1074);
    expect(pts.ys[0]).toBeCloseTo(16);
    // Clockwise on screen: the next points go down the right side.
    expect(pts.ys[1]!).toBeGreaterThan(pts.ys[0]!);
    // Evenly spaced along it (a step across a corner is a little shorter than along it).
    const gaps = pts.xs.map((x, i) => {
      const j = (i + 1) % 96;
      return Math.hypot(pts.xs[j]! - x, pts.ys[j]! - pts.ys[i]!);
    });
    expect(Math.max(...gaps)).toBeLessThan(6.5);
    expect(Math.min(...gaps)).toBeGreaterThan(3);
    // Docked, its top goes a little into the bezel; nothing of it below its bottom.
    expect(Math.min(...pts.ys)).toBeCloseTo(-LIFT);
    expect(Math.max(...pts.ys)).toBeLessThanOrEqual(32 + 1e-9);
  });

  it("marks the points glued to the bezel: the top, and the flush side in a corner", () => {
    const pts = sample(outline(middle), 96);
    const { top, side } = wetMask(middle, pts);
    expect(top.reduce((s, v) => s + v, 0)).toBeGreaterThan(20);
    expect(side.reduce((s, v) => s + v, 0)).toBe(0);
    const corner = { ...middle, x: 92, corner: -1 };
    const cp = sample(outline(corner), 96);
    expect(wetMask(corner, cp).side.reduce((s, v) => s + v, 0)).toBeGreaterThan(3);
    const floating = { ...middle, docked: false };
    const fp = sample(outline(floating), 96);
    expect(wetMask(floating, fp).top.every((v) => v === 0)).toBe(true);
  });
});
