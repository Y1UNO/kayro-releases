import { describe, expect, it } from "vitest";
import { motionTokens } from "../../design/motion/tokens";
import { cascadeDelay, passagePlan } from "./passage";

const t = motionTokens(undefined);

describe("passages between display modes, fade version (round 4b)", () => {
  it("fades out in « micro », back in « moyen », the cards rise 14 px 45 ms apart", () => {
    const p = passagePlan(t, false, false);
    expect(p.instant).toBe(false);
    expect(p.out).toEqual({ duration: 140, easing: t.ease.out });
    expect(p.in).toEqual({ duration: 360, easing: t.ease.in });
    expect([p.cascade.rise, p.cascade.step, p.cascade.duration]).toEqual([14, 45, 360]);
    expect(p.cascade.easing).toBe(t.ease.move);
    expect(p.widgetFrom).toBe(0.96);
  });

  it("the cascade stops growing after twelve cards", () => {
    const p = passagePlan(t, false, false);
    expect([0, 1, 5].map((i) => cascadeDelay(p, i))).toEqual([0, 45, 225]);
    expect(cascadeDelay(p, 40)).toBe(11 * 45);
  });

  it("reduce motion, level 2 off or Éco: the change is direct", () => {
    expect(passagePlan(t, false, true).instant).toBe(true);
    expect(passagePlan(t, true, false).instant).toBe(true);
    expect(passagePlan(motionTokens({ on: true, level2: false }), false, false).instant).toBe(true);
  });

  it("speed scales the fades and the cascade", () => {
    const p = passagePlan(motionTokens({ on: true, speed: "1.5" }), false, false);
    expect(p.in.duration).toBeCloseTo(240);
    expect(p.cascade.step).toBeCloseTo(30);
  });
});
