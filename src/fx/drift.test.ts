import { describe, expect, it } from "vitest";
import { FOG_DRIFTS, SWAY_PERIOD, fogTransform, pingPong, swayTransform } from "./css/drift";

describe("drift (mock-up keyframes driven by the frame loop)", () => {
  it("goes there and back once per period", () => {
    expect(pingPong(0, 1000)).toBe(0);
    expect(pingPong(500, 1000)).toBe(1);
    expect(pingPong(1000, 1000)).toBe(0);
    expect(pingPong(250, 1000)).toBeCloseTo(0.5);
  });

  it("sways between -3° and 3° over 12 s", () => {
    expect(swayTransform(0)).toBe("rotate(-3.000deg)");
    expect(swayTransform(SWAY_PERIOD / 2)).toBe("rotate(3.000deg)");
  });

  it("fog A reaches the mock-up's middle pose at half period", () => {
    const a = FOG_DRIFTS[0];
    expect(fogTransform(a, a.period / 2)).toBe("translate(22.000%, -9.500%) scale(1.1500)");
    expect(fogTransform(a, 0)).toBe("translate(0.000%, 0.000%) scale(1.0000)");
  });
});
