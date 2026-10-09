import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_BACKDROP_SURFACES,
  acquireBackdrop,
  backdropInUse,
  releaseBackdrop,
  resetBackdropBudget,
} from "./backdropBudget";

describe("backdrop-filter budget", () => {
  beforeEach(resetBackdropBudget);

  it("allows at most 6 simultaneous surfaces", () => {
    expect(MAX_BACKDROP_SURFACES).toBe(6);
    for (let i = 0; i < 6; i++) expect(acquireBackdrop()).toBe(true);
    expect(acquireBackdrop()).toBe(false);
    expect(backdropInUse()).toBe(6);
  });

  it("frees a slot on release and never goes negative", () => {
    for (let i = 0; i < 6; i++) acquireBackdrop();
    releaseBackdrop();
    expect(acquireBackdrop()).toBe(true);
    resetBackdropBudget();
    releaseBackdrop();
    expect(backdropInUse()).toBe(0);
  });
});
