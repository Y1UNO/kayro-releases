import { describe, expect, it } from "vitest";
import { QUALITIES } from "../design";
import { budgetFor } from "./budget";
import { emberAlpha, seedEmbers, seedStars, twinkle } from "./canvas/particles";

describe("embers and stars", () => {
  it("start and end invisible, peak in between", () => {
    expect(emberAlpha(0)).toBe(0);
    expect(emberAlpha(1)).toBeCloseTo(0, 6);
    expect(emberAlpha(0.15)).toBeCloseTo(0.9, 6);
    expect(twinkle(0)).toBe(0);
    expect(twinkle(0.5)).toBeCloseTo(1, 6);
  });

  it("are seeded inside their zone, with positive sizes and periods", () => {
    const e = new Float32Array(40 * 5);
    seedEmbers(e, 40, { on: true, zoneX: 50, zoneW: 20, zoneTop: 70, zoneH: 10, size: 3, life: 9 });
    const s = new Float32Array(40 * 5);
    seedStars(s, 40, { on: true, zoneTop: 10, zoneH: 30, size: 2, twinkle: 4 });
    for (let i = 0; i < 40; i++) {
      const o = i * 5;
      expect(e[o]).toBeGreaterThanOrEqual(0.4 - 1e-6);
      expect(e[o]).toBeLessThanOrEqual(0.6 + 1e-6);
      expect(e[o + 1]).toBeGreaterThanOrEqual(0.7 - 1e-6);
      expect(e[o + 1]).toBeLessThanOrEqual(0.8 + 1e-6);
      expect(e[o + 2]).toBeGreaterThan(0);
      expect(e[o + 3]).toBeGreaterThan(0);
      expect(s[o + 1]).toBeGreaterThanOrEqual(0.1 - 1e-6);
      expect(s[o + 1]).toBeLessThanOrEqual(0.4 + 1e-6);
    }
  });

  it("are fewer in Eco and Balanced, none with reduced motion", () => {
    expect(budgetFor("high", false).particles).toBe(1);
    expect(budgetFor("eco", false).particles).toBeLessThan(1);
    for (const q of QUALITIES) expect(budgetFor(q, true).particles).toBe(0);
  });
});
