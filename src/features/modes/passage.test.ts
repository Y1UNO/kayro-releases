import { describe, expect, it } from "vitest";
import { motionTokens } from "../../design/motion/tokens";
import { cascadeDelay, parseRgb, passagePlan, veilFade } from "./passage";

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

describe("native veil between main and the widget (round 4b, option A)", () => {
  it("main gives way: its dark veil leaves in 0.7 × court on the disappearance curve", () => {
    const v = veilFade(t, "main", [15, 10, 22]);
    expect([v.r, v.g, v.b, v.ms]).toEqual([15, 10, 22, 168]);
    expect(v.curve).toHaveLength(17);
    expect(v.curve[0]).toBe(0);
    expect(v.curve[16]).toBe(1);
    expect(v.curve[4]!).toBeLessThan(0.25); // slow then fast (sortie)
  });

  it("the widget gives way: the veil comes in court on the appearance curve", () => {
    const v = veilFade(t, "widget", [1, 2, 3]);
    expect(v.ms).toBe(240);
    expect(v.curve[4]!).toBeGreaterThan(0.25); // fast then slow (vive)
  });

  it("reads the colours the page computes", () => {
    expect(parseRgb("rgb(15, 10, 22)")).toEqual([15, 10, 22]);
    expect(parseRgb("rgba(15, 10, 22, 0.5)")).toEqual([15, 10, 22]);
    expect(parseRgb("transparent")).toBeNull();
  });
});
