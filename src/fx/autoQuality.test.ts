import { describe, expect, it } from "vitest";
import { AutoQuality, type AutoRung } from "./autoQuality";

const P = 1000 / 144;

/** Plays `ms` of frames at `period`, every `slowEvery`-th one doubled (a missed refresh). */
function play(a: AutoQuality, from: number, ms: number, slowEvery = 0, sequence = false) {
  const changes: AutoRung[] = [];
  let t = from;
  let i = 0;
  while (t < from + ms) {
    const dt = slowEvery > 0 && ++i % slowEvery === 0 ? 3 * P : P;
    t += dt;
    const r = a.frame(dt, t, sequence);
    if (r) changes.push(r);
  }
  return { t, changes };
}

describe("AutoQuality", () => {
  it("stays at the top while frames are on time", () => {
    const a = new AutoQuality();
    expect(play(a, 0, 60_000).changes).toEqual([]);
    expect(a.state).toEqual({ rung: "high", reason: null, frozen: false });
  });

  it("ignores a few slow frames, steps down after two bad windows", () => {
    const a = new AutoQuality();
    // One slow frame in 100: under the threshold.
    expect(play(a, 0, 20_000, 100).changes).toEqual([]);
    // One in 10: two bad windows in a row → one rung down (the next one needs two more).
    const { changes } = play(a, 20_000, 6_000, 10);
    expect(changes).toEqual(["hover"]);
    expect(a.state.reason).toBe("slow");
  });

  it("does not count the frames of a scripted sequence", () => {
    const a = new AutoQuality();
    expect(play(a, 0, 10_000, 3, true).changes).toEqual([]);
  });

  it("goes down to Eco at most, then climbs back after a calm minute", () => {
    const a = new AutoQuality();
    const down = play(a, 0, 30_000, 5);
    expect(down.changes).toEqual(["hover", "float", "balanced", "eco"]);
    // Calm: 30 s without a slow frame and 60 s since the last step down → one rung up at a time.
    const up = play(a, down.t, 160_000);
    expect(up.changes).toEqual(["balanced", "float", "hover", "high"]);
    expect(a.state.reason).toBeNull();
  });

  it("freezes after going back and forth twice in ten minutes", () => {
    const a = new AutoQuality();
    /** Plays half-seconds until the rung changes (two minutes at most). */
    const until = (from: number, slowEvery: number) => {
      let t = from;
      for (let k = 0; k < 240; k++) {
        const r = play(a, t, 500, slowEvery);
        t = r.t;
        if (r.changes.length) return t;
      }
      return t;
    };
    let t = until(0, 5); // down
    for (let k = 0; k < 2; k++) {
      t = until(t, 0); // up
      t = until(t, 5); // down again: one flap, then two
    }
    expect(a.frozen).toBe(true);
    const at = a.state.rung;
    expect(play(a, t, 120_000).changes).toEqual([]);
    expect(play(a, t + 120_000, 20_000, 3).changes).toEqual([]);
    expect(a.state.rung).toBe(at);
  });

  it("treats a long gap as a pause, not a slow frame", () => {
    const a = new AutoQuality();
    let t = play(a, 0, 1_000).t;
    for (let k = 0; k < 20; k++) a.frame(2_000, (t += 2_000), false);
    expect(play(a, t, 5_000).changes).toEqual([]);
  });

  it("sees a PC slow on every frame once it knows the screen's rate", () => {
    const slowAll = (a: AutoQuality) => {
      const out: string[] = [];
      for (let t = 0; t < 10_000; t += 3 * P) {
        const r = a.frame(3 * P, t, false);
        if (r) out.push(r);
      }
      return out;
    };
    expect(slowAll(new AutoQuality())).toEqual([]); // every frame alike: nothing to compare with
    const a = new AutoQuality();
    a.setScreenHz(144);
    expect(slowAll(a)[0]).toBe("hover");
  });

  it("holds Balanced at most on battery", () => {
    const a = new AutoQuality();
    expect(a.setBattery(true)).toBe(true);
    expect(a.state).toMatchObject({ rung: "balanced", reason: "battery" });
    expect(play(a, 0, 200_000).changes).toEqual([]); // never back above Balanced
    expect(a.setBattery(false)).toBe(true);
    expect(a.state.rung).toBe("high");
  });
});
