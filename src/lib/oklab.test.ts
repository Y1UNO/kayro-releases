import { describe, expect, it } from "vitest";
import { chromaOf, hexToLab, hueGap, hueOf, labToHex, labToRgb, rgbToLab } from "./oklab";

describe("OKLab", () => {
  it("round-trips sRGB colours", () => {
    for (const hex of ["#000000", "#ffffff", "#c82828", "#0c8a5a", "#7282bc", "#f6efe8"]) {
      expect(labToHex(hexToLab(hex))).toBe(hex);
    }
  });

  it("matches the reference values (pure red)", () => {
    const [L, a, b] = rgbToLab([255, 0, 0]);
    expect(L).toBeCloseTo(0.628, 2);
    expect(a).toBeCloseTo(0.225, 2);
    expect(b).toBeCloseTo(0.126, 2);
  });

  it("brings out-of-gamut colours back by their chroma, hue and lightness kept", () => {
    const wild = [0.7, 0.35, -0.3] as const;
    const back = rgbToLab(labToRgb(wild));
    expect(back[0]).toBeCloseTo(0.7, 1);
    expect(Math.abs(hueOf(back) - hueOf(wild))).toBeLessThan(0.1);
    expect(chromaOf(back)).toBeLessThan(chromaOf(wild));
  });

  it("measures hue gaps on the circle", () => {
    expect(hueGap([0.7, 0.1, 0], [0.7, -0.1, 0])).toBeCloseTo(180, 0);
    expect(hueGap([0.7, 0.1, 0.001], [0.7, 0.1, -0.001])).toBeLessThan(2);
  });
});
