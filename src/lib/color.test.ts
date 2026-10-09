import { describe, expect, it } from "vitest";
import { contrastRatio, flatten, luminance, mustParse, over, parseColor } from "./color";

describe("parseColor", () => {
  it("reads hex, rgb() and rgba()", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#ffb98a")).toEqual({ r: 255, g: 185, b: 138, a: 1 });
    expect(parseColor("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseColor("rgba(160,104,214,.42)")).toEqual({ r: 160, g: 104, b: 214, a: 0.42 });
  });

  it("rejects garbage and out-of-range values", () => {
    expect(parseColor("red")).toBeNull();
    expect(parseColor("#12")).toBeNull();
    expect(parseColor("rgb(300,0,0)")).toBeNull();
    expect(parseColor("rgba(0,0,0,2)")).toBeNull();
  });
});

describe("compositing", () => {
  it("half white over black is mid gray", () => {
    const c = over({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
    expect(c).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
  });

  it("flatten stacks bottom-first", () => {
    const c = flatten([mustParse("#000"), mustParse("rgba(255,255,255,1)")]);
    expect(c.r).toBe(255);
  });
});

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(luminance(mustParse("#000"))).toBe(0);
    expect(luminance(mustParse("#fff"))).toBeCloseTo(1, 5);
    expect(contrastRatio(mustParse("#fff"), mustParse("#000"))).toBeCloseTo(21, 5);
    expect(contrastRatio(mustParse("#777"), mustParse("#fff"))).toBeCloseTo(4.48, 2);
  });

  it("flattens a translucent foreground over the background", () => {
    const solid = contrastRatio(mustParse("#808080"), mustParse("#000"));
    const translucent = contrastRatio(mustParse("rgba(255,255,255,.5)"), mustParse("#000"));
    expect(translucent).toBeCloseTo(solid, 1);
  });
});
