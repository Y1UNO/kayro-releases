import { describe, expect, it } from "vitest";
import { MAX_DT_MS, createFrameLoop } from "./loop";

/** Fake requestAnimationFrame: frames are fired by hand at chosen timestamps. */
function fakeRaf() {
  let pending: FrameRequestCallback | null = null;
  let id = 0;
  return {
    raf: (cb: FrameRequestCallback) => {
      pending = cb;
      return ++id;
    },
    caf: () => {
      pending = null;
    },
    fire(now: number) {
      const cb = pending;
      pending = null;
      cb?.(now);
    },
    get requested() {
      return pending !== null;
    },
  };
}

describe("frame loop", () => {
  it("requests no frame without subscribers, and stops when the last one leaves", () => {
    const r = fakeRaf();
    const loop = createFrameLoop(r.raf, r.caf);
    expect(r.requested).toBe(false);
    const off = loop.subscribe(() => {});
    expect(loop.active).toBe(true);
    off();
    expect(loop.active).toBe(false);
    expect(r.requested).toBe(false);
  });

  it("passes the real elapsed time, bounded after a long gap", () => {
    const r = fakeRaf();
    const loop = createFrameLoop(r.raf, r.caf);
    const dts: number[] = [];
    loop.subscribe((dt) => dts.push(dt));
    r.fire(1000); // first frame: reference only
    r.fire(1016.7);
    r.fire(1023.6);
    r.fire(5000);
    expect(dts.map((d) => Math.round(d * 10) / 10)).toEqual([16.7, 6.9, MAX_DT_MS]);
  });

  it("caps a subscriber's rate (144 Hz on a 279 Hz screen)", () => {
    const r = fakeRaf();
    const loop = createFrameLoop(r.raf, r.caf);
    let fast = 0;
    let capped = 0;
    loop.subscribe(() => fast++);
    loop.subscribe(() => capped++, 144);
    const step = 1000 / 279;
    for (let i = 0; i <= 279; i++) r.fire(i * step); // one second
    expect(fast).toBe(279);
    expect(capped).toBeGreaterThanOrEqual(130);
    expect(capped).toBeLessThanOrEqual(144);
  });

  it("pause stops the frames; resume restarts without a jump", () => {
    const r = fakeRaf();
    const loop = createFrameLoop(r.raf, r.caf);
    const dts: number[] = [];
    loop.subscribe((dt) => dts.push(dt));
    r.fire(0);
    r.fire(10);
    loop.pause();
    expect(r.requested).toBe(false);
    loop.resume();
    r.fire(60_000); // first frame after resume: reference only
    r.fire(60_010);
    expect(dts).toEqual([10, 10]);
  });
});
