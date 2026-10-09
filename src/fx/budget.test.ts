import { describe, expect, it } from "vitest";
import { QUALITIES } from "../design";
import { AMBIENT_FPS, ECO_MAX_FPS, FX_MAX_FPS, budgetFor, dustCount, fxFps } from "./budget";

describe("quality budget (ARCHITECTURE.md §5)", () => {
  it("Eco and Balanced have no continuous animation", () => {
    for (const q of ["eco", "balanced"] as const) {
      const b = budgetFor(q, false);
      expect(b).toMatchObject({ fog: "static", beam: false, sway: false, dust: 0 });
    }
    expect(budgetFor("eco", false).maxFps).toBe(ECO_MAX_FPS);
  });

  it("High animates fog, beam and dust; Ultra = High for now", () => {
    const high = budgetFor("high", false);
    expect(high).toMatchObject({ fog: "animated", beam: true, sway: true });
    expect(high.dust).toBeGreaterThan(0);
    expect(budgetFor("ultra", false)).toEqual(high);
  });

  it("reduced motion: no sway, no particles, static fog, at every level", () => {
    for (const q of QUALITIES) {
      expect(budgetFor(q, true)).toMatchObject({ fog: "static", sway: false, dust: 0 });
    }
  });

  it("dust keeps the mock-up density, at most twice its count", () => {
    expect(dustCount(14, 1280, 760)).toBe(14);
    expect(dustCount(14, 800, 600)).toBe(14);
    expect(dustCount(14, 1920, 1080)).toBe(28);
    expect(dustCount(14, 2560, 1440)).toBe(28);
    expect(dustCount(0, 2560, 1440)).toBe(0);
  });

  it("continuous layers share a capped cadence, never above 144 Hz", () => {
    expect(fxFps(budgetFor("high", false))).toBe(AMBIENT_FPS);
    expect(fxFps(budgetFor("eco", false))).toBe(ECO_MAX_FPS);
    expect(fxFps(budgetFor("high", false), 30)).toBe(30);
    expect(fxFps(budgetFor("high", false), 500)).toBe(FX_MAX_FPS);
  });
});
