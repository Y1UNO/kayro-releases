import { describe, expect, it } from "vitest";
import { linearCss, ROW_SPRING, SPRING_H, SPRING_V } from "../../design/motion/springCurves";
import { motionTokens } from "../../design/motion/tokens";
import { foldDuration, foldSteps, unrollSteps, type Step, type Target } from "./unroll";

/** End of the last step (ms). */
function stepsEnd(steps: readonly Step[]): number {
  return steps.reduce((m, s) => Math.max(m, s.options.delay + s.options.duration), 0);
}

const t = motionTokens(undefined);
const shape = { rows: 4, chips: [0, 0, 2, 3], eco: false };
const is = (a: Target, b: Target) => JSON.stringify(a) === JSON.stringify(b);
const find = (steps: Step[], target: Target, prop: "transform" | "opacity") =>
  steps.filter((s) => is(s.target, target) && prop in s.keyframes[0]!);

describe("widget panel: the glass unrolls (round 4b)", () => {
  it("the shell unrolls on the vertical spring and widens on the horizontal one", () => {
    const steps = unrollSteps(t, shape);
    const [h] = find(steps, "hull", "transform");
    const [v] = find(steps, "inner", "transform");
    expect(h!.keyframes).toEqual([{ transform: "scaleX(0.86)" }, { transform: "scaleX(1)" }]);
    expect(h!.options).toMatchObject({
      delay: 0,
      duration: 560,
      easing: linearCss(SPRING_H.normale),
    });
    expect(v!.keyframes[0]).toEqual({ transform: "translateY(-12px) scaleY(0.04)" });
    expect(v!.options).toMatchObject({
      delay: 0,
      duration: 680,
      easing: linearCss(SPRING_V.normale),
    });
    const [fade] = find(steps, "hull", "opacity");
    expect(fade!.options.duration).toBe(60);
  });

  it("rows at 50 / 110 / 170 / 230 ms, 10 px on the 3.5 % spring; pills 50 ms after, 35 ms apart", () => {
    const steps = unrollSteps(t, shape);
    for (let i = 0; i < 4; i++) {
      const [move] = find(steps, { row: i }, "transform");
      const [fade] = find(steps, { row: i }, "opacity");
      expect(move!.options).toMatchObject({ delay: 50 + 60 * i, duration: 520 });
      expect(move!.options.easing).toBe(linearCss(ROW_SPRING));
      expect(move!.keyframes[0]).toEqual({ transform: "translateY(-10px)" });
      expect(fade!.options).toMatchObject({ delay: 50 + 60 * i, duration: 260 });
    }
    const chips = steps.filter((s) => typeof s.target === "object" && "chip" in s.target);
    expect(chips).toHaveLength(5);
    const c = find(steps, { chip: [3, 2] }, "transform")[0]!;
    expect(c.options.delay).toBe(230 + 50 + 70);
    expect(c.keyframes[0]).toEqual({ transform: "scale(0.7)" });
  });

  it("halo at 80 ms, band at 380 ms, bar breath ×1.02; none of the decorations in Éco", () => {
    const steps = unrollSteps(t, shape);
    expect(find(steps, "halo", "opacity")[0]!.options).toMatchObject({ delay: 80, duration: 700 });
    expect(find(steps, "sheen", "transform")[0]!.options).toMatchObject({
      delay: 380,
      duration: 950,
    });
    expect(find(steps, "bar", "transform")[0]!.keyframes[1]).toEqual({ transform: "scale(1.02)" });
    const eco = unrollSteps(t, { ...shape, eco: true });
    expect(eco.some((s) => s.target === "halo" || s.target === "sheen")).toBe(false);
    expect(find(eco, "inner", "transform")).toHaveLength(1); // the springs stay
  });

  it("opening steps keep only their start pose before they begin (the CSS look after)", () => {
    for (const s of unrollSteps(t, shape)) {
      if (s.target !== "bar") expect(s.options.fill).toBe("backwards");
    }
  });

  it("folds fast without bounce: content in 100 ms, shell at 70 ms in 240 ms, gone in the last 90", () => {
    const steps = foldSteps(t, false);
    expect(find(steps, "content", "opacity")[0]!.options).toMatchObject({
      delay: 0,
      duration: 100,
    });
    const [h] = find(steps, "hull", "transform");
    expect(h!.options).toMatchObject({ delay: 70, duration: 240, easing: t.ease.out });
    expect(h!.keyframes[1]).toEqual({ transform: "scaleX(0.86)" });
    expect(find(steps, "hull", "opacity")[0]!.options).toMatchObject({ delay: 220, duration: 90 });
    expect(stepsEnd(steps)).toBe(310);
    expect(foldDuration(t)).toBe(310);
    for (const s of steps) expect(s.options.fill).toBe("forwards");
  });

  it("a click during the folding starts back from where the boxes are, without the rows", () => {
    const from = {
      hull: { transform: "matrix(0.9, 0, 0, 1, 0, 0)", opacity: "0.8" },
      inner: "matrix(1, 0, 0, 0.5, 0, -6)",
      content: "0.3",
      halo: "0.5",
    };
    const steps = unrollSteps(t, shape, from);
    expect(find(steps, "inner", "transform")[0]!.keyframes[0]).toEqual({ transform: from.inner });
    expect(find(steps, "content", "opacity")[0]!.keyframes[0]).toEqual({ opacity: "0.3" });
    expect(steps.some((s) => typeof s.target === "object")).toBe(false);
  });

  it("speed scales every time; « sobre » is the first proposal (fade, rows 30 ms apart)", () => {
    const fast = motionTokens({ on: true, speed: "1.5" });
    expect(stepsEnd(foldSteps(fast, false))).toBeCloseTo(310 / 1.5);
    const sober = motionTokens({ on: true, widgetMotion: "sobre" });
    const steps = unrollSteps(sober, shape);
    expect(steps.filter((s) => typeof s.target === "object").map((s) => s.options.delay)).toEqual([
      0, 30, 60, 90,
    ]);
    expect(foldDuration(sober)).toBe(180);
  });
});
