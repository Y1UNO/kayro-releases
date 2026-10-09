import { describe, expect, it } from "vitest";
import { contrastRatio } from "../lib/color";
import { contrastPairs } from "./contrast";
import { BUILTIN_THEMES } from "./themes";

const MIN_RATIO = 4.5;

describe("text/surface contrast (WCAG AA, >= 4.5:1)", () => {
  for (const theme of BUILTIN_THEMES) {
    describe(theme.name, () => {
      for (const pair of contrastPairs(theme)) {
        it(pair.name, () => {
          const ratio = contrastRatio(pair.fg, pair.bg);
          expect(ratio, `${pair.name}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_RATIO);
        });
      }
    });
  }
});
