import { describe, expect, it } from "vitest";
import { advance, dustAlpha, seedParticles } from "./canvas/dust";
import { clampIntensity } from "./createFx";

describe("dust particles", () => {
  it("are seeded like the mock-up, in its lower area", () => {
    const s = new Float32Array(28 * 5);
    seedParticles(s, 28);
    for (let i = 0; i < 28; i++) {
      const [x, y, size, dur, phase] = s.slice(i * 5, i * 5 + 5);
      expect(x).toBeGreaterThanOrEqual(60 / 1280 - 1e-6);
      expect(x).toBeLessThanOrEqual(1220 / 1280 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(0.5 - 1e-6);
      expect(size).toBeGreaterThanOrEqual(2);
      expect(size).toBeLessThanOrEqual(5);
      expect(dur).toBeGreaterThanOrEqual(10_000);
      expect(dur).toBeLessThanOrEqual(19_000);
      expect(phase).toBeGreaterThanOrEqual(0);
    }
  });

  it("advance by real time and wrap around", () => {
    const s = new Float32Array(5);
    seedParticles(s, 1);
    s[4] = 0.9;
    const dur = s[3]!;
    advance(s, 1, dur * 0.2);
    expect(s[4]).toBeCloseTo(0.1, 5);
  });

  it("fade like the keyframes 0 → .85 → .5 → 0", () => {
    expect(dustAlpha(0)).toBe(0);
    expect(dustAlpha(0.15)).toBeCloseTo(0.85);
    expect(dustAlpha(0.85)).toBeCloseTo(0.5);
    expect(dustAlpha(0.9999)).toBeCloseTo(0, 2);
  });
});

describe("intensity", () => {
  it("is bounded to 0.3–1, missing = 1", () => {
    expect(clampIntensity(null)).toBe(1);
    expect(clampIntensity(Number.NaN)).toBe(1);
    expect(clampIntensity(0.1)).toBe(0.3);
    expect(clampIntensity(2)).toBe(1.3);
    expect(clampIntensity(0.6)).toBe(0.6);
  });
});
