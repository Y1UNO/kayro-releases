import { describe, expect, it } from "vitest";
import {
  DANCE,
  danceOverlay,
  danceSpan,
  IMPACT,
  impactAt,
  impactOverlay,
  impactPose,
  impactStart,
  tabSpan,
} from "./fanDance";

describe("landing of a tab change (30/10)", () => {
  const end = IMPACT.rise + IMPACT.squash + IMPACT.settle;

  it("comes forward and grows with a shake, squashes, then settles back exactly", () => {
    expect(impactPose(0)).toEqual({ y: 0, sc: 1, x: 0 });
    const top = impactPose(IMPACT.rise - 1);
    expect(top.sc).toBeGreaterThan(1.08);
    expect(top.y).toBeLessThan(-11);
    const squashed = impactPose(IMPACT.rise + IMPACT.squash - 1);
    expect(squashed.sc).toBeLessThan(0.95);
    expect(squashed.y).toBeGreaterThan(1);
    expect(impactPose(end)).toEqual({ y: 0, sc: 1, x: 0 });
    // A light shake while it arrives, dying out once it has landed.
    const xs = Array.from({ length: 30 }, (_, i) => Math.abs(impactPose(150 + i * 5).x));
    expect(Math.max(...xs)).toBeGreaterThan(0.5);
    for (let t = 0; t < end; t += 5) expect(Math.abs(impactPose(t).x)).toBeLessThanOrEqual(2);
    expect(Math.abs(impactPose(end - 5).x)).toBeLessThan(0.05);
  });

  it("the selected card lands first, the others still dance during its squash", () => {
    const dur = 1250;
    expect(impactAt(dur)).toBe(dur - DANCE.lead + 2 * DANCE.wave);
    expect(impactStart(dur)).toBe(impactAt(dur) - IMPACT.rise - IMPACT.squash);
    expect(tabSpan(dur)).toBe(Math.max(danceSpan(dur), impactAt(dur) + IMPACT.settle));
    expect(impactAt(0)).toBe(0);
    const slots = [0, 1, 2, 3, 4].map((k) => ({ k, x: (k - 2) * 230 }));
    const v = new Map<string, number>();
    for (const { k, x } of slots) {
      v.set(`a${k}.x`, x);
      v.set(`a${k}.y`, 0);
      v.set(`a${k}.sc`, 1);
    }
    danceOverlay(v, slots, impactAt(dur), dur, DANCE.wave, DANCE.lead);
    expect(v.get("a2.x")).toBe(0); // at its place
    expect(Math.abs(v.get("a4.x")! - 460)).toBeGreaterThan(5); // still on the ring
  });

  it("moves the middle card only, over its own track", () => {
    const v = new Map([
      ["a2.sc", 1],
      ["a2.y", 0],
      ["a2.x", 0],
      ["a1.sc", 0.74],
    ]);
    impactOverlay(v, 1000 + IMPACT.rise, 1000, 1);
    expect(v.get("a2.sc")).toBeGreaterThan(1.05);
    expect(v.get("a1.sc")).toBe(0.74);
  });
});
