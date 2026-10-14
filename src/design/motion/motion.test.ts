import { describe, expect, it } from "vitest";
import { createFrameLoop } from "../../fx/loop";
import { activeSequences, Choreo } from "./choreo";
import { cubicBezier, curveOf, seg } from "./curve";

/** Fake requestAnimationFrame: frames are fired by hand at chosen timestamps. */
function fakeLoop() {
  let pending: FrameRequestCallback | null = null;
  const loop = createFrameLoop(
    (cb) => {
      pending = cb;
      return 1;
    },
    () => {
      pending = null;
    },
  );
  return {
    loop,
    fire(now: number) {
      const cb = pending;
      pending = null;
      cb?.(now);
    },
  };
}

describe("curves", () => {
  it("cubic-bezier starts at 0, ends at 1 and matches known points", () => {
    const c = cubicBezier(0.42, 0, 0.58, 1);
    expect(c(0)).toBe(0);
    expect(c(1)).toBe(1);
    expect(c(0.5)).toBeCloseTo(0.5, 4);
    // CSS `ease` at half time is about 0.8024.
    expect(curveOf("ease")(0.5)).toBeCloseTo(0.8024, 3);
  });

  it("an overshooting curve passes 1 (the spec's spring: 3.4 %)", () => {
    const c = curveOf("cubic-bezier(.34,1.32,.64,1)");
    let max = 0;
    for (let i = 0; i <= 200; i++) max = Math.max(max, c(i / 200));
    expect(max).toBeGreaterThan(1.03);
    expect(max).toBeLessThan(1.04);
  });

  it("unknown timing functions fall back to linear; segments clamp", () => {
    expect(curveOf("nonsense")(0.3)).toBeCloseTo(0.3);
    expect(seg(50, 100, 200)).toBe(0);
    expect(seg(400, 100, 200)).toBe(1);
    expect(seg(200, 100, 200)).toBeCloseTo(0.5);
  });
});

describe("choreo (scripted sequences)", () => {
  it("renders on the frame loop up to the end, then resolves true", async () => {
    const f = fakeLoop();
    const c = new Choreo(f.loop);
    const seen: number[] = [];
    const done = c.play(100, (t) => seen.push(t));
    expect(seen).toEqual([0]);
    expect(activeSequences()).toBe(1);
    f.fire(1000); // the loop's first frame after a subscribe only takes the time
    f.fire(1010);
    expect(c.time(1010)).toBe(0); // t = 0 is the first tick
    f.fire(1060);
    f.fire(1200);
    expect(await done).toBe(true);
    expect(seen.at(-1)).toBe(100);
    expect(c.active).toBe(false);
    expect(activeSequences()).toBe(0);
  });

  it("one sequence at a time: a new play cancels the previous one (resolves false)", async () => {
    const f = fakeLoop();
    const c = new Choreo(f.loop);
    const first = c.play(500, () => {});
    const second = c.play(500, () => {});
    expect(await first).toBe(false);
    c.cancel();
    expect(await second).toBe(false);
    expect(activeSequences()).toBe(0);
  });

  it("reduced motion renders the final state at once, without the frame loop", async () => {
    const f = fakeLoop();
    const c = new Choreo(f.loop);
    const seen: number[] = [];
    expect(await c.play(800, (t) => seen.push(t), { reduced: true })).toBe(true);
    expect(seen).toEqual([800]);
    expect(f.loop.active).toBe(false);
  });

  it("seek renders one moment and keeps it as the time", () => {
    const f = fakeLoop();
    const c = new Choreo(f.loop);
    const seen: number[] = [];
    c.seek(1234, (t) => seen.push(t));
    expect(seen).toEqual([1234]);
    expect(c.time(99_999)).toBe(1234);
  });
});
