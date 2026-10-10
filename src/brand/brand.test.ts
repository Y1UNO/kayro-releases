import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, mustParse } from "../lib/color";
import { GLYPH_PATH, TILE_PATH } from "./symbol";
import { variantSvg } from "./logoVariant";
import { DEFAULT_LOGO_VARIANT, LOGO_VARIANTS, LOGO_VARS, MIN_LOGO_CONTRAST } from "./variants";

const worst = (v: (typeof LOGO_VARIANTS)[number]) =>
  Math.min(
    contrastRatio(mustParse(v.symbole), mustParse(v.haut)),
    contrastRatio(mustParse(v.symbole), mustParse(v.bas)),
  );

describe("logo variants (variantes.json)", () => {
  it("has the 6 variants, unique ids, default 7a", () => {
    expect(LOGO_VARIANTS.map((v) => v.id)).toEqual(["7a", "7e", "7f", "7h", "7i", "7j"]);
    expect(DEFAULT_LOGO_VARIANT.id).toBe("7a");
  });

  it("names the three CSS variables", () => {
    expect(LOGO_VARS).toEqual({
      haut: "--logo-top",
      bas: "--logo-bottom",
      symbole: "--logo-glyph",
    });
  });

  for (const v of LOGO_VARIANTS) {
    it(`${v.id}: symbol contrast >= ${MIN_LOGO_CONTRAST}:1 on both gradient ends`, () => {
      const ratio = worst(v);
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_LOGO_CONTRAST);
      expect(ratio).toBeCloseTo(v.contraste_min, 1);
    });
  }
});

describe("symbol geometry", () => {
  const svg = readFileSync("src/assets/brand/symbole.svg", "utf8");
  it("matches assets/brand/symbole.svg", () => {
    expect(svg).toContain(`d="${TILE_PATH}"`);
    expect(svg).toContain(`d="${GLYPH_PATH}"`);
  });
  it("standalone variant SVG carries the variant colours", () => {
    const out = variantSvg(LOGO_VARIANTS[2]!);
    expect(out).toContain("#F7B7C4");
    expect(out).toContain("#D9708E");
    expect(out).not.toContain("var(");
  });
});
