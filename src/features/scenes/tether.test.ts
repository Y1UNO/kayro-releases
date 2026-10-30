import { describe, expect, it } from "vitest";
import { hookOf, makeRope, ropeLength, ropePath, stepRope, THREAD, tiltOf } from "./tether";

/** Runs `ms` of motion at `fps`, the pointer moved by `move` (ms → position). */
function run(fps: number, ms: number, move: (t: number) => { x: number; y: number }) {
  const r = makeRope(0, 0);
  const dt = 1000 / fps;
  for (let t = 0; t < ms; t += dt) {
    const p = move(t);
    stepRope(r, p.x, p.y, dt);
  }
  return r;
}

describe("tether rope (step 19c)", () => {
  it("hangs still and straight under the pointer", () => {
    const r = run(144, 1000, () => ({ x: 0, y: 0 }));
    expect(hookOf(r).x).toBeCloseTo(0, 1);
    expect(Math.abs(hookOf(r).y - THREAD)).toBeLessThan(1.5);
    expect(tiltOf(r)).toBeCloseTo(0, 1);
  });

  it("pulled to the right, the frame trails on the left and turns its top towards the pull", () => {
    // 150 ms of a steady move to the right (1 000 px/s).
    const r = run(144, 150, (t) => ({ x: t, y: 0 }));
    const pointer = 150;
    expect(hookOf(r).x).toBeLessThan(pointer - 10);
    expect(tiltOf(r)).toBeGreaterThan(5); // clockwise: its top leans to the right
  });

  it("swings, then settles; the same at 60, 144 and 279 Hz", () => {
    const ends = [60, 144, 279].map((fps) =>
      run(fps, 3000, (t) => ({ x: t < 200 ? t * 2 : 400, y: 0 })),
    );
    for (const r of ends) {
      expect(hookOf(r).x).toBeCloseTo(400, -0.5);
      expect(Math.abs(tiltOf(r))).toBeLessThan(2);
    }
    expect(Math.abs(hookOf(ends[0]!).x - hookOf(ends[2]!).x)).toBeLessThan(2);
  });

  it("the thread never stretches, and goes slack when the pointer drops", () => {
    const pulled = run(144, 300, (t) => ({ x: t * 3, y: -t }));
    expect(ropeLength(pulled)).toBeLessThan(THREAD * 1.06);
    // A quick drop: the frame is below, the thread folds (its points are not on a line).
    const r = makeRope(0, 0);
    for (let i = 0; i < 4; i += 1) stepRope(r, 0, i * 15, 1000 / 144);
    expect(ropePath(r)).toMatch(/^M0\.0 45\.0 Q/);
  });

  it("calm: after a quick flick it swings back once at most and rests within a second and a half", () => {
    const r = makeRope(0, 0);
    const dt = 1000 / 144;
    let flips = 0;
    let last = 0;
    let rested = Infinity;
    for (let t = 0; t < 2000; t += dt) {
      stepRope(r, t < 120 ? t * 4 : 480, 0, dt);
      const tilt = tiltOf(r);
      if (Math.abs(tilt) > 1 && Math.sign(tilt) !== Math.sign(last) && last !== 0) flips += 1;
      if (Math.abs(tilt) > 1) last = tilt;
      if (t > 120 && Math.abs(tilt) < 1 && rested === Infinity) rested = t;
      if (Math.abs(tilt) >= 1) rested = Infinity;
    }
    expect(flips).toBeLessThanOrEqual(1);
    expect(rested).toBeLessThan(1500);
  });

  it("a long pause is not caught up (no explosion)", () => {
    const r = makeRope(0, 0);
    stepRope(r, 500, 500, 5000);
    expect(Number.isFinite(hookOf(r).x) && Math.abs(hookOf(r).x) < 2000).toBe(true);
  });
});
