import { describe, expect, it } from "vitest";
import { QUALITIES } from "../design";
import { AMBIENT_FPS, ECO_MAX_FPS, FX_MAX_FPS, budgetFor, fxFps } from "./budget";

describe("quality budget (ARCHITECTURE.md §5)", () => {
  it("Eco and Balanced keep the drifts static", () => {
    for (const q of ["eco", "balanced"] as const) {
      expect(budgetFor(q, false).fog).toBe("static");
    }
    expect(budgetFor("eco", false).maxFps).toBe(ECO_MAX_FPS);
  });

  it("High animates the drifts; Ultra = High", () => {
    const high = budgetFor("high", false);
    expect(high.fog).toBe("animated");
    expect(budgetFor("ultra", false)).toEqual(high);
  });

  it("reduced motion: no particles, static drifts, at every level", () => {
    for (const q of QUALITIES) {
      expect(budgetFor(q, true)).toMatchObject({ fog: "static", particles: 0 });
    }
  });

  it("continuous layers share a capped cadence, never above 144 Hz", () => {
    expect(fxFps(budgetFor("high", false))).toBe(AMBIENT_FPS);
    expect(fxFps(budgetFor("eco", false))).toBe(ECO_MAX_FPS);
    expect(fxFps(budgetFor("high", false), 30)).toBe(30);
    expect(fxFps(budgetFor("high", false), 500)).toBe(FX_MAX_FPS);
  });
});
