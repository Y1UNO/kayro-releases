import { describe, expect, it } from "vitest";
import { MAX_BOUNCE } from "../glass/pillMotion";
import { curveOf } from "./curve";
import { linearCss, SPRING_H, SPRING_V, UNROLL_SPRINGS } from "./springCurves";
import { motionCss, motionTokens } from "./tokens";
import { WIDGET_UNROLL } from "./tokens4b";

const peak = (css: string) => {
  const c = curveOf(css);
  let max = 0;
  for (let i = 0; i <= 800; i++) max = Math.max(max, c(i / 800));
  return max - 1;
};

describe("springs written as linear() (round 4b, widget)", () => {
  it("each overshoots by what the spec announces, never more than 8 %", () => {
    for (const table of [SPRING_V, SPRING_H]) {
      for (const name of UNROLL_SPRINGS) {
        const s = table[name];
        expect(s.points).toHaveLength(41);
        expect(s.points[0]).toBe(0);
        expect(s.points.at(-1)).toBe(1);
        expect(peak(linearCss(s))).toBeCloseTo(s.overshoot, 3);
        expect(s.overshoot).toBeLessThanOrEqual(MAX_BOUNCE);
      }
    }
    expect([SPRING_V.douce, SPRING_V.normale, SPRING_V.forte].map((s) => s.overshoot)).toEqual([
      0.035, 0.05, 0.07,
    ]);
    expect([SPRING_H.douce, SPRING_H.normale, SPRING_H.forte].map((s) => s.overshoot)).toEqual([
      0.015, 0.025, 0.035,
    ]);
  });

  it("curveOf reads linear(): evenly spaced points, piecewise linear", () => {
    const c = curveOf("linear(0, 0.5, 1.2, 1)");
    expect(c(0)).toBe(0);
    expect(c(1 / 6)).toBeCloseTo(0.25);
    expect(c(2 / 3)).toBeCloseTo(1.2);
    expect(c(1)).toBe(1);
    expect(curveOf("linear(0, nope)")(0.5)).toBe(0.5); // unreadable → a straight line
  });

  it("the token table exposes them: « normale » by default, the others in the workshop", () => {
    const w = motionTokens(undefined).widget;
    expect(w.motion).toBe("deroule");
    expect(w.spring).toBe("normale");
    expect(w.springV).toBe(linearCss(SPRING_V.normale));
    expect(w.springH).toBe(linearCss(SPRING_H.normale));
    expect([w.vMs, w.hMs, w.foldMs]).toEqual([680, 560, 240]);
    expect([w.fromScaleY, w.fromY, w.fromScaleX]).toEqual([0.04, -12, 0.86]);
    expect(w.halo && w.sheen).toBe(true);
    const forte = motionTokens({ on: true, widgetSpring: "forte", widgetMotion: "sobre" }).widget;
    expect(forte.springV).toBe(linearCss(SPRING_V.forte));
    expect(forte.motion).toBe("sobre");
    expect(motionTokens({ on: true, widgetSpring: "nope" }).widget.spring).toBe("normale");
    expect(motionCss(motionTokens(undefined))["--m-spring-v"]).toBe(w.springV);
  });

  it("speed divides the widget's times, not its distances", () => {
    const w = motionTokens({ on: true, speed: "1.5" }).widget;
    expect(w.vMs).toBeCloseTo(WIDGET_UNROLL.vMs / 1.5);
    expect(w.rowStep).toBeCloseTo(40);
    expect(w.rowRise).toBe(10);
    expect(w.chipFrom).toBe(0.7);
  });
});
