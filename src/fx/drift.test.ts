import { describe, expect, it } from "vitest";
import { pingPong } from "./css/drift";

describe("drift (driven by the frame loop)", () => {
  it("goes there and back once per period", () => {
    expect(pingPong(0, 1000)).toBe(0);
    expect(pingPong(500, 1000)).toBe(1);
    expect(pingPong(1000, 1000)).toBe(0);
    expect(pingPong(250, 1000)).toBeCloseTo(0.5);
  });
});
