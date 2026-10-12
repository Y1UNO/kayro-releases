import { describe, expect, it } from "vitest";
import { FLOAT_LEVELS, FLOAT_RHYTHM } from "../../../design/motion/tokens5";
import { floatAt, floatLevel, seedOfKey } from "./cardFloat";

describe("card floating (R5-Flottaison)", () => {
  it("has the note's levels, Visible when unknown", () => {
    expect(floatLevel("visible")).toEqual({ fan: 7, carousel: 5, tilt: 0.8, period: 4400 });
    expect(floatLevel("strong")).toMatchObject({ fan: 12, carousel: 8, tilt: 1.4 });
    expect(floatLevel("light")).toMatchObject({ fan: 2.5, carousel: 2 });
    expect(floatLevel("nope")).toBe(FLOAT_LEVELS.visible);
    expect(floatLevel("none").fan).toBe(0);
  });

  it("rises and falls within its amplitude, rocking within its tilt", () => {
    let top = 0;
    let bottom = 0;
    let rock = 0;
    for (let t = 0; t < 20000; t += 13) {
      const s = floatAt(1, t, 7, 0.8, 4400);
      top = Math.min(top, s.dy);
      bottom = Math.max(bottom, s.dy);
      rock = Math.max(rock, Math.abs(s.rot));
      expect(s.elev).toBeGreaterThanOrEqual(0);
      expect(s.elev).toBeLessThanOrEqual(1);
    }
    expect(top).toBeCloseTo(-7, 1);
    expect(bottom).toBeCloseTo(7, 1);
    expect(rock).toBeCloseTo(0.8, 2);
    expect(floatAt(0, 1234, 0, 0.8, 4400)).toEqual({ dy: 0, rot: 0, elev: 0 });
  });

  it("never moves the cards « en bloc »: own period, staggered start, alternate rocking", () => {
    const a = floatAt(0, 1000, 7, 0.8, 4400);
    const b = floatAt(1, 1000, 7, 0.8, 4400);
    expect(a.dy).not.toBeCloseTo(b.dy, 2);
    // Rocking alternates: card 0 leans one way when it rises, card 1 the other way.
    for (let t = 0; t < 9000; t += 250) {
      const c0 = floatAt(0, t, 7, 0.8, 4400);
      const c1 = floatAt(1, t, 7, 0.8, 4400);
      if (Math.abs(c0.dy) > 0.5) expect(Math.sign(c0.rot)).toBe(-Math.sign(c0.dy));
      if (Math.abs(c1.dy) > 0.5) expect(Math.sign(c1.rot)).toBe(Math.sign(c1.dy));
    }
    // Card 1 starts 0.6–0.7 s after card 0: at its start it is where card 0 was at 0.
    expect(floatAt(0, 0, 7, 0.8, 4400).dy).toBeCloseTo(0, 6);
    const start1 = [...Array(2000).keys()].find(
      (t) => Math.abs(floatAt(1, t, 7, 0.8, 4400).dy) < 0.02,
    );
    expect(start1).toBeGreaterThanOrEqual(FLOAT_RHYTHM.staggerMin - 1);
    expect(start1).toBeLessThanOrEqual(FLOAT_RHYTHM.staggerMax + 1);
  });

  it("the ground shadow changes fully only at « Marquée » on the fan", () => {
    let max = 0;
    for (let t = 0; t < 10000; t += 7) max = Math.max(max, floatAt(2, t, 12, 1.4, 4800).elev);
    expect(max).toBeCloseTo(1, 2);
    let visible = 0;
    for (let t = 0; t < 10000; t += 7)
      visible = Math.max(visible, floatAt(2, t, 7, 0.8, 4400).elev);
    expect(visible).toBeCloseTo(14 / 24, 2);
  });

  it("gives each app its own rhythm (stable seed of its id)", () => {
    expect(seedOfKey("steam")).toBe(seedOfKey("steam"));
    expect(seedOfKey("steam")).not.toBe(seedOfKey("discord"));
  });
});
