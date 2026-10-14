import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("prefersReducedMotion (step 13: one media query)", () => {
  it("asks Windows through a single query object, read live", async () => {
    const query = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const matchMedia = vi.fn(() => query);
    vi.stubGlobal("matchMedia", matchMedia);
    const { prefersReducedMotion, onReducedMotionChange } = await import("./motionPref");
    expect(prefersReducedMotion()).toBe(false);
    query.matches = true;
    expect(prefersReducedMotion()).toBe(true);
    onReducedMotionChange(() => {})();
    expect(matchMedia).toHaveBeenCalledTimes(1);
  });

  it("is false where matchMedia does not exist", async () => {
    const { prefersReducedMotion } = await import("./motionPref");
    expect(prefersReducedMotion()).toBe(false);
  });
});
