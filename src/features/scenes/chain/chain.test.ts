import { describe, expect, it } from "vitest";
import { motionTokens } from "../../../design/motion/tokens";
import type { StepView } from "../../../store";
import { chainState } from "./chainState";
import { shiftOf, translateOf } from "./useListMotion";

const v = (state: StepView["state"]): StepView => ({ state, reason: null });

describe("scene editor chain (round 4b)", () => {
  it("without a test: filled points, no thread filled", () => {
    expect(chainState(3, undefined)).toEqual([
      { point: "idle", filled: false },
      { point: "idle", filled: false },
      { point: "idle", filled: false },
    ]);
  });

  it("during a test the thread fills from point to point as each next step starts", () => {
    const c = chainState(4, [v("ok"), v("running"), v("pending"), v("pending")]);
    expect(c.map((x) => x.point)).toEqual(["ok", "running", "waiting", "waiting"]);
    expect(c.map((x) => x.filled)).toEqual([true, false, false, false]);
  });

  it("a failure that stops the scene: red point, the thread stops there", () => {
    const c = chainState(4, [v("ok"), v("failed"), v("skipped"), v("skipped")]);
    expect(c.map((x) => x.point)).toEqual(["ok", "failed", "skipped", "skipped"]);
    expect(c.map((x) => x.filled)).toEqual([true, false, false, false]);
  });

  it("a failure of a step that is not required: the engine goes on, so does the thread", () => {
    const c = chainState(3, [v("failed"), v("ok"), v("running")]);
    expect(c.map((x) => x.filled)).toEqual([true, true, false]);
  });

  it("reads the offsets of a slide in progress and of a drag shift", () => {
    expect(translateOf("none")).toBe(0);
    expect(translateOf("matrix(1, 0, 0, 1, 0, -12.5)")).toBe(-12.5);
    expect(translateOf("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 8, 0, 1)")).toBe(8);
    expect(shiftOf("none")).toBe(0);
    expect(shiftOf("0px 84px")).toBe(84);
    expect(shiftOf("4px")).toBe(0);
  });

  it("its timings come from the motion table (point × 0.4 after 120 ms, active × 1.18)", () => {
    const c = motionTokens(undefined).chain;
    expect([c.pointFrom, c.pointDelay, c.active, c.demoLaunch, c.demoWait]).toEqual([
      0.4, 120, 1.18, 520, 900,
    ]);
    expect(motionTokens({ on: true, speed: "1.5" }).chain.pointDelay).toBeCloseTo(80);
    const s = motionTokens(undefined).states;
    expect([s.emptyFloat, s.floatPeriod, s.shakeMs, s.noticeMs]).toEqual([4, 5000, 240, 6000]);
    expect(s.shake).toEqual([5, 3]);
  });
});
