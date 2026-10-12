import { describe, expect, it } from "vitest";
import {
  FanMotion,
  hoverConfig,
  MAX_SPARKS,
  pathPoint,
  perimeter,
  threadHeads,
  sparksAt,
  threadPhase,
} from "./fanFloat";

const cfg = hoverConfig(undefined, false, false);

describe("fan hover and floating (round 3b, part B)", () => {
  it("defaults: lift 12 px, tilt ≤ 3°, slight growth, ≤ 12 sparks; Eco halves the sparks", () => {
    expect(cfg).toMatchObject({ lift: 12, tilt: 3, grow: 0.03, hoverMs: 240, sparks: 12 });
    expect(cfg.bounce).toBe(0.05); // "léger" spring: the card pops a little
    expect(hoverConfig({ on: true, tilt: 9 }, false, false).tilt).toBe(3);
    expect(hoverConfig({ on: true, sparks: 40 }, false, false).sparks).toBe(MAX_SPARKS);
    expect(hoverConfig(undefined, true, false).sparks).toBe(6);
  });

  it("reduced motion: no floating, no lift, no tilt, no sparks, threads still", () => {
    const r = hoverConfig(undefined, false, true);
    expect(r).toMatchObject({ lift: 0, tilt: 0, grow: 0, sparks: 0, floatRest: 0, floatHover: 0 });
    expect(r.hoverMs).toBe(0);
    expect(threadPhase(1234, 0.5, true)).toBe(threadPhase(99999, 0.5, true));
  });

  it("floats at the level of the settings (Visible by default, Légère = the old values)", () => {
    expect(hoverConfig(undefined, false, false)).toMatchObject({ floatRest: 7, floatTilt: 0.8 });
    expect(hoverConfig({ on: true, float: "light" }, false, false)).toMatchObject({
      floatRest: 2.5,
      floatPeriod: 7000,
    });
    expect(hoverConfig({ on: true, float: "none" }, false, false).floatRest).toBe(0);
    // Eco floats as before (only the sparks are halved).
    expect(hoverConfig({ on: true, float: "strong" }, true, false).floatRest).toBe(12);
  });

  it("rim points follow the offset-path: on the edge, clockwise from the top", () => {
    const [w, h, r] = [210, 290, 24];
    const P = perimeter(w, h, r);
    expect(P).toBeCloseTo(2 * (210 + 290) - (8 - 2 * Math.PI) * 24, 6);
    expect(pathPoint(0, w, h, r)).toEqual([24, 0, 0, -1]);
    expect(pathPoint(P, w, h, r)[0]).toBeCloseTo(24, 6); // closed path
    const right = pathPoint(w - 2 * r + (Math.PI / 2) * r + 10, w, h, r);
    expect(right[0]).toBe(210);
    expect(right[1]).toBeCloseTo(34, 6);
    expect([right[2], right[3]]).toEqual([1, 0]);
    for (let d = 0; d < P; d += 17) {
      const [x, y] = pathPoint(d, w, h, r);
      const dx = Math.max(r - x, 0, x - (w - r));
      const dy = Math.max(r - y, 0, y - (h - r));
      // On the rounded rectangle: on a side, or on a corner circle.
      const onSide = x === 0 || x === w || y === 0 || y === h;
      if (!onSide) expect(Math.hypot(dx, dy)).toBeCloseTo(r, 6);
    }
    // Threads in opposite directions, half a turn apart at the start.
    expect(threadHeads(0, P)).toEqual([0, P / 2]);
    const [a1, b1] = threadHeads(0.1, P);
    expect(a1).toBeGreaterThan(0);
    expect(b1).toBeLessThan(P / 2);
  });

  it("sparks: at most 12, near the rim, fading in and out", () => {
    const out = new Float32Array(MAX_SPARKS * 4);
    const box = { w: 210, h: 290, r: 24 };
    const ph = (t: number) => threadPhase(t, 0.4, false);
    expect(sparksAt(1000, 20, 1, box, ph, 2, out)).toBe(MAX_SPARKS);
    expect(sparksAt(1000, 8, 0, box, ph, 2, out)).toBe(0);
    const n = sparksAt(1000, 8, 1, box, ph, 2, out);
    for (let j = 0; j < n; j++) {
      expect(out[j * 4]!).toBeGreaterThan(-30);
      expect(out[j * 4]!).toBeLessThan(240);
      expect(out[j * 4 + 1]!).toBeGreaterThan(-40);
      expect(out[j * 4 + 1]!).toBeLessThan(320);
      expect(out[j * 4 + 3]).toBeGreaterThanOrEqual(0);
      expect(out[j * 4 + 3]).toBeLessThanOrEqual(1);
    }
  });

  it("hover level eases in over hoverMs, the pointer tilt follows, the loop can stop", () => {
    const m = new FanMotion(
      hoverConfig({ on: true, float: "none", floatHover: 0, sway: 0 }, false, false),
    );
    expect(m.busy(0)).toBe(false);
    expect(m.floatingOnly(0)).toBe(true);
    m.setHover(2, true, 0);
    expect(m.floatingOnly(0)).toBe(false);
    m.setPointer(2, 1, 0);
    expect(m.level(2, 0)).toBe(0);
    expect(m.level(2, 350)).toBe(1);
    expect(m.hovered(400)).toBe(2);
    expect(m.busy(400)).toBe(true); // threads run while hovered
    for (let t = 0; t <= 1000; t += 16) m.step(t);
    const s = m.sample(2, 1000);
    expect(s.lift).toBe(12);
    expect(s.tiltY).toBeCloseTo(3, 1);
    m.setHover(2, false, 1000);
    expect(m.level(2, 1100)).toBeGreaterThan(0);
    expect(m.level(2, 1350)).toBe(0);
    for (let t = 1000; t <= 2000; t += 16) m.step(t);
    expect(m.busy(2000)).toBe(false);
    expect(m.hovered(2000)).toBe(-1);
  });

  it("hover-in pops on a light spring, with a burst that fades within a second", () => {
    const m = new FanMotion(hoverConfig(undefined, false, false));
    m.setHover(1, true, 0);
    let peak = 0;
    for (let t = 0; t <= 240; t += 4) peak = Math.max(peak, m.level(1, t));
    expect(peak).toBeGreaterThan(1.02); // passes 1 a little (the card "pops")
    expect(peak).toBeLessThanOrEqual(1.08 + 1e-9); // never more than MAX_BOUNCE
    expect(m.level(1, 240)).toBeCloseTo(1, 6);
    expect(m.burst(1, 0)).toBeCloseTo(0.8, 6);
    expect(m.burst(1, 600)).toBeLessThan(0.1);
    expect(m.burst(1, 1300)).toBe(0);
    // The threads whip half a turn (× burst) on top of their steady run.
    const steady = threadPhase(2000, 0.25, false);
    expect(m.phase(1, 2000) - steady).toBeCloseTo(0.4, 2);
    m.setHover(1, false, 2000);
    expect(m.burst(1, 2010)).toBe(0);
    const r = new FanMotion(hoverConfig(undefined, false, true));
    r.setHover(0, true, 0);
    expect(r.burst(0, 0)).toBe(0);
  });

  it("hovered, the card pivots slowly left / right, the whole tilt stays within 3°", () => {
    const m = new FanMotion(hoverConfig(undefined, false, false));
    m.setHover(2, true, 0);
    m.setPointer(2, 1, 0);
    for (let t = 0; t <= 600; t += 16) m.step(t);
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 600; t < 600 + 3600; t += 20) {
      const y = m.sample(2, t).tiltY;
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    expect(hi).toBeLessThanOrEqual(3);
    expect(hi - lo).toBeGreaterThan(1.5); // it really swings
    const r = new FanMotion(hoverConfig(undefined, false, true));
    r.setHover(2, true, 0);
    expect(r.sample(2, 1000).tiltY).toBe(0);
  });
});
