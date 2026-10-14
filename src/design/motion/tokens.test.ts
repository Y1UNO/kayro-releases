import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ELEMENTS } from "../da/catalogue";
import { elementDefaults } from "../da/values";
import { MAX_BOUNCE, SPRINGS } from "../glass/pillMotion";
import { curveOf } from "./curve";
import { EASES } from "./eases";
import {
  bezierOf,
  durOf,
  fmTransition,
  MOTION_DEFAULTS,
  motionCss,
  motionTokens,
  springOf,
} from "./tokens";

const peak = (css: string) => {
  const c = curveOf(css);
  let max = 0;
  for (let i = 0; i <= 400; i++) max = Math.max(max, c(i / 400));
  return max - 1;
};

describe("motion token table (round 4a)", () => {
  it("has the spec's values by default", () => {
    const t = motionTokens(undefined);
    expect(t.dur).toEqual({ micro: 140, court: 240, moyen: 360, long: 540 });
    expect(t.outShare).toBe(0.7);
    expect(t.ease.in).toBe(EASES.vive);
    expect(bezierOf(t.ease.in)).toEqual([0.16, 1, 0.3, 1]);
    expect(bezierOf(t.ease.out)).toEqual([0.7, 0, 0.84, 0]);
    expect(bezierOf(t.ease.move)).toEqual([0.34, 1.32, 0.64, 1]);
    expect(bezierOf(t.ease.bounce)).toEqual([0.34, 1.45, 0.64, 1]);
    expect([t.cascade, t.rise, t.press, t.panelScale]).toEqual([45, 14, 0.94, 0.96]);
    expect(t.levels).toEqual([true, true, true]);
  });

  it("the catalogue element starts from the table, and its CSS is the table's", () => {
    const el = ELEMENTS.get("motion")!;
    const v = elementDefaults(el);
    expect(motionTokens(v)).toEqual(motionTokens(undefined));
    expect(el.css!(v)).toEqual(motionCss(motionTokens(undefined)));
  });

  it("motion.css repeats the same defaults (used when the element is off)", () => {
    const css = readFileSync(new URL("../motion.css", import.meta.url), "utf-8");
    const root = css.slice(css.indexOf(":root {"), css.indexOf("--m-rm"));
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    for (const [name, value] of Object.entries(motionCss(motionTokens(undefined)))) {
      const m = new RegExp(`${name}:([^;]+);`).exec(root);
      expect(m, name).not.toBeNull();
      expect(norm(m![1]!), name).toBe(norm(value));
    }
  });

  it("the springs: déplacement = liaison 3.4 %, rebond 6.6 %, both in SPRINGS (≤ 8 %)", () => {
    expect(peak(EASES.liaison!)).toBeCloseTo(SPRINGS.liaison!, 2);
    expect(peak(EASES.rebond!)).toBeGreaterThan(0.06);
    expect(peak(EASES.rebond!)).toBeLessThan(0.07);
    expect(SPRINGS.rebond).toBe(0.066);
    expect(SPRINGS.rebond!).toBeLessThanOrEqual(MAX_BOUNCE);
    expect(springOf("liaison")).toBe(0.034);
    expect(springOf("vive")).toBe(0); // a curve without a spring: no bounce
  });

  it("speed divides the durations and the cascade", () => {
    const fast = motionTokens({ on: true, speed: "1.5" });
    expect(fast.dur.moyen).toBeCloseTo(240);
    expect(fast.cascade).toBeCloseTo(30);
    expect(motionTokens({ on: true, speed: "0.7" }).dur.court).toBeCloseTo(240 / 0.7);
  });

  it("a level off or reduced motion = final state at once; exits last 0.7 ×", () => {
    const t = motionTokens({ on: true, level2: false });
    expect(durOf(t, 2, "moyen", false)).toBe(0);
    expect(durOf(t, 1, "court", false)).toBe(240);
    expect(durOf(t, 1, "court", true)).toBe(0);
    expect(durOf(motionTokens(undefined), 2, "moyen", false, true)).toBeCloseTo(252);
    expect(motionCss(t)["--m-l2"]).toBe("0");
    expect(fmTransition(t, 3, "court", "bounce", false)).toEqual({
      duration: 0.24,
      ease: [0.34, 1.45, 0.64, 1],
    });
  });

  it("off, or with unknown curves, falls back to the defaults", () => {
    expect(motionTokens({ on: false, micro: 400 }).dur.micro).toBe(MOTION_DEFAULTS.micro);
    expect(motionTokens({ on: true, easeIn: "nope" }).easeNames.in).toBe("vive");
  });

  it("the focus ring uses the theme's colours (background, A, B)", () => {
    const ring = motionCss(motionTokens(undefined))["--m-focus"]!;
    expect(ring).toContain("0 0 0 3px var(--bg-mid)");
    expect(ring).toContain("0 0 0 5px var(--grad-a)");
    expect(ring).toContain("var(--grad-b) 50%");
    expect(ring).toContain("0 0 26px color-mix(in srgb, var(--grad-a) 45%");
  });

  it("the selection pill takes its timing from the table (no setting of its own)", () => {
    const keys = ELEMENTS.get("glassPills")!.params.map((p) => p.key);
    expect(keys).not.toContain("duration");
    expect(keys).not.toContain("spring");
  });
});
