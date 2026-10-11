import { describe, expect, it } from "vitest";
import { chainOpacity, parseRadius, radiusPx } from "../../design/glass/glassRegistry";
import { parsePreset } from "../../design/da";
import cristal from "../../design/presets/v4-cristal.json";
import verre from "../../design/presets/v4-verre-liquide.json";
import { pillAt } from "../../design/glass/pillMotion";
import { BudgetWatch, LADDER, WINDOW } from "./budgetWatch";
import { DROP_MS, dropAt, ringPhase } from "./liquidRing";

const feed = (w: BudgetWatch, slow: boolean) => {
  let rung = null;
  for (let i = 0; i < WINDOW; i++) {
    // 7 ms ticks; a slow window drops every tenth frame to 21 ms (p95 = 3 × median).
    const r = w.push(slow && i % 10 === 0 ? 21 : 7);
    if (r) rung = r;
  }
  return rung;
};

describe("glass engine frame budget", () => {
  it("ignores jitter and a single bad window", () => {
    const w = new BudgetWatch();
    expect(feed(w, false)).toBeNull();
    expect(feed(w, true)).toBeNull();
    expect(feed(w, false)).toBeNull();
    expect(w.level).toBe(0);
  });

  it("steps down after two bad windows in a row: resolution, then each kind, then off", () => {
    const w = new BudgetWatch();
    const rungs: string[] = [];
    for (let i = 0; i < 2 * LADDER.length; i++) {
      const r = feed(w, true);
      if (r) rungs.push(r);
    }
    expect(rungs).toEqual([...LADDER]);
    expect(w.off).toBe(true);
  });

  it("drops the least visible glass first", () => {
    const w = new BudgetWatch();
    expect(w.scale()).toBe(1);
    w.level = 2; // scale, button
    expect(w.scale()).toBe(0.75);
    expect(w.allows("button")).toBe(false);
    expect(w.allows("dock")).toBe(true);
    expect(w.allows("card")).toBe(true);
    expect(w.allows("ring")).toBe(true);
    expect(w.allows("pill")).toBe(true);
    w.level = 7; // … bar, pill, card, ring
    expect(w.allows("pill")).toBe(false);
    expect(w.allows("ring")).toBe(false);
    expect(w.off).toBe(false);
  });
});

describe("glass shapes from the DOM", () => {
  it("reads radii in px or percent", () => {
    expect(parseRadius("30px")).toBe(30);
    expect(parseRadius("50%")).toBe(-0.5);
    expect(parseRadius("0px")).toBe(0);
    expect(parseRadius("")).toBe(0);
  });

  it("keeps pills as pills and scales radii with the element", () => {
    expect(radiusPx(999, 200, 29, 1)).toBe(29);
    expect(radiusPx(30, 120, 168, 0.74)).toBeCloseTo(22.2);
    expect(radiusPx(-0.5, 19, 19, 1)).toBe(19);
  });

  it("multiplies the opacity of the whole chain", () => {
    expect(chainOpacity([{ opacity: "1" }, { opacity: "0.5" }, { opacity: "0.5" }])).toBe(0.25);
    expect(chainOpacity([{ opacity: "0" }, { opacity: "1" }])).toBe(0);
  });
});

describe("liquid glass presets", () => {
  it("V4 Verre liquide: glass cards and pills only, liquid ring, posters fully visible", () => {
    const a = parsePreset(verre);
    if (!a.ok) throw new Error(a.error);
    const v = a.preset.values;
    expect([v.glassCards?.on, v.glassPills?.on, v.liquidRing?.on]).toEqual([true, true, true]);
    expect([v.glassBars?.on, v.glassDock?.on, v.glassButtons?.on, v.glassRing?.on]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(v.glassCards?.posterOpacity).toBe(1);
  });

  it("V4 Verre liquide runs the engine, V4 Cristal keeps the CSS look", () => {
    const a = parsePreset(verre);
    const b = parsePreset(cristal);
    expect(a.ok && a.preset.values.glassEngine?.on).toBe(true);
    expect(b.ok && b.preset.values.glassEngine?.on).toBe(false);
  });
});

describe("selection pill slide", () => {
  const a = { x: 0, y: 0, w: 80, h: 36 };
  const b = { x: 200, y: 0, w: 100, h: 36 };

  it("starts and ends exactly on the items", () => {
    expect(pillAt(a, b, 0, 0.35)).toEqual(a);
    expect(pillAt(a, b, 1, 0.35)).toEqual(b);
  });

  it("stretches on the way (leading edge first), never thinner than 88 %", () => {
    const mid = pillAt(a, b, 0.5, 0.35);
    expect(mid.w).toBeGreaterThan(90);
    expect(mid.h).toBeGreaterThanOrEqual(36 * 0.88);
    const rigid = pillAt(a, b, 0.5, 0);
    expect(rigid.w).toBeCloseTo(90);
    const back = pillAt(b, a, 0.3, 0.35);
    expect(back.x).toBeLessThan(b.x); // moving left: the left edge leads
  });
});

describe("liquid ring motion", () => {
  it("turns at the given average speed, sometimes backwards", () => {
    const minute = 60_000;
    const turns = ringPhase(60 * minute, 0.5) / (2 * Math.PI);
    expect(turns / 60).toBeGreaterThan(0.35);
    expect(turns / 60).toBeLessThan(0.65);
    let reversed = false;
    for (let t = 0; t < 10 * minute && !reversed; t += 500) {
      if (ringPhase(t + 500, 0.5) < ringPhase(t, 0.5)) reversed = true;
    }
    expect(reversed).toBe(true);
  });

  it("drops about `rate` times a minute, each one lasting DROP_MS", () => {
    expect(dropAt(1000, 0)).toBeNull();
    let starts = 0;
    let was = false;
    for (let t = 0; t < 10 * 60_000; t += 100) {
      const d = dropAt(t, 1.2);
      if (d && !was) starts++;
      was = d !== null;
      if (d) expect(d.progress).toBeLessThanOrEqual(1);
    }
    expect(starts).toBe(12);
    expect(DROP_MS).toBeLessThan(60_000 / 1.2);
  });
});
