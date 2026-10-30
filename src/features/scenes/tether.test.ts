import { describe, expect, it } from "vitest";
import { MAX_TILT, restBob, stepBob, THREAD, threadPath, tiltOf } from "./tether";

describe("tether (step 19b)", () => {
  it("hangs still under the pointer", () => {
    const bob = stepBob(restBob(100, 50), 100, 50, 16);
    expect(bob.x).toBeCloseTo(100);
    expect(bob.y).toBeCloseTo(50 + THREAD);
    expect(tiltOf(bob, 100, 50)).toBeCloseTo(0);
  });

  it("lags behind a quick move, swings, then settles, whatever the frame rate", () => {
    const run = (fps: number) => {
      let bob = restBob(0, 0);
      const dt = 1000 / fps;
      bob = stepBob(bob, 200, 0, dt);
      const lag = bob.x;
      const tilt = tiltOf(bob, 200, 0);
      for (let t = 0; t < 2000; t += dt) bob = stepBob(bob, 200, 0, dt);
      return { lag, tilt, end: bob };
    };
    for (const fps of [60, 144, 279]) {
      const { lag, tilt, end } = run(fps);
      expect(lag).toBeLessThan(50); // far behind the pointer at first
      expect(tilt).toBe(MAX_TILT); // tilted along the thread, at most the cap
      expect(end.x).toBeCloseTo(200, 0);
      expect(end.y).toBeCloseTo(THREAD, 0);
    }
  });

  it("a long pause is cut into small steps (no explosion)", () => {
    const bob = stepBob(restBob(0, 0), 500, 500, 5000);
    expect(Number.isFinite(bob.x) && Math.abs(bob.x) < 2000).toBe(true);
  });

  it("the thread sags when slack", () => {
    const taut = threadPath(0, 0, { x: 0, y: THREAD, vx: 0, vy: 0 });
    const slack = threadPath(0, 0, { x: 0, y: 10, vx: 0, vy: 0 });
    const controlY = (d: string) => Number(d.split(" Q")[1]?.split(" ")[1]);
    expect(controlY(slack) - 5).toBeGreaterThan(controlY(taut) - THREAD / 2);
  });
});
