import { describe, expect, it } from "vitest";
import { stretch } from "./usePullOut";

describe("pulling a row out of « Mes apps » (step 19c)", () => {
  it("follows the pointer with more and more resistance, never past its limit", () => {
    expect(stretch(0)).toBe(0);
    expect(stretch(20)).toBeGreaterThan(5);
    expect(stretch(20)).toBeLessThan(20);
    expect(stretch(120)).toBeCloseTo(35);
    expect(stretch(10_000)).toBeLessThan(70);
    expect(stretch(-120)).toBeCloseTo(-35);
  });
});
