import { describe, expect, it } from "vitest";
import { defaultValues } from "../../design/da/values";
import type { FxParams } from "../FxLayer";
import { SPRITE_FRAGMENT } from "./bgShader";
import { Scene, SPRITE_FLOATS } from "./scene";

const palette = {
  beam: [0, 0, 0],
  fog: ["", "", ""],
  a: [163, 176, 222],
  b: [114, 130, 188],
} as never;

function bokehSprites(quality: "eco" | "high") {
  const s = new Scene();
  const p = defaultValues() as unknown as FxParams;
  s.configure({ ...p, embers: { on: false }, stars: { on: false } } as FxParams, quality, false);
  s.fill(p, palette, 1700, 960, 1);
  const out = [];
  for (let i = 0; i < s.count; i++)
    out.push(Array.from(s.sprites.subarray(i * SPRITE_FLOATS, (i + 1) * SPRITE_FLOATS)));
  return out;
}

describe("bokeh (round 5, proposal 1)", () => {
  it("7 discs of 60–180 px at 0.09, over 8–88 % of the height; 4 in Eco", () => {
    const high = bokehSprites("high");
    expect(high).toHaveLength(7);
    for (const [, y, size, a] of high) {
      expect(size).toBeGreaterThanOrEqual(60);
      expect(size).toBeLessThanOrEqual(180);
      expect(a).toBeLessThanOrEqual(0.09 + 1e-6);
      expect(y).toBeGreaterThan(0.08 * 960 - 15);
      expect(y).toBeLessThan(0.88 * 960 + 15);
    }
    expect(bokehSprites("eco")).toHaveLength(4);
  });

  it("their colour is the theme's A → B lightened 35 % towards white", () => {
    for (const s of bokehSprites("high")) {
      for (const c of s.slice(4, 7))
        expect(c).toBeGreaterThanOrEqual(0.35 + 0.65 * (114 / 255) - 1e-6);
    }
  });

  it("is drawn as a soft disc and a thin ring (no flat disc with a hard rim)", () => {
    expect(SPRITE_FRAGMENT).toContain(
      "a = 0.55 * exp(-r * r * 2.2) + 0.45 * smoothstep(0.80, 0.93, r) * (1.0 - smoothstep(0.95, 1.0, r));",
    );
    expect(SPRITE_FRAGMENT).not.toContain("smoothstep(1.0, 0.86, r)");
  });
});
