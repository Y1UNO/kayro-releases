import { describe, expect, it } from "vitest";
import { GLITCH_COLOURS, GLITCH_STEP, Glitch, straddle, type GlitchInput } from "./glitch";

const island = { x: 272, y: 150, width: 176, height: 44 };
const across = (seamX: number | null, x = island.x): GlitchInput => ({
  seamX,
  seamY: null,
  island: { ...island, x },
  origin: { x: 1000, y: 0 },
});

const seeded = () => {
  let seed = 7;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

/** Steps `g` for `secs` at 60 Hz. */
const run = (g: Glitch, input: GlitchInput, secs: number, resting = false) => {
  let shown = false;
  for (let t = 0; t < secs; t += 1 / 60) shown = g.step(1 / 60, input, resting);
  return shown;
};

describe("Kysland's glitch passage (step 20)", () => {
  it("is strongest with the island centred on the edge, gone once clear of it", () => {
    expect(straddle(across(360))).toBe(1);
    expect(straddle(across(316))).toBeCloseTo(0.5, 5);
    expect(straddle(across(null))).toBe(0);
    expect(straddle(across(100))).toBe(0);
  });

  it("draws held frames: the spikes change every step, not every frame", () => {
    const g = new Glitch(seeded());
    g.step(1 / 144, across(360));
    const first = g.take();
    expect(first?.length).toBeGreaterThan(4);
    g.step(1 / 144, across(360));
    expect(g.take()).toBeNull();
    g.step(GLITCH_STEP, across(360));
    expect(g.take()).not.toBe(first);
  });

  it("its spikes start on the edge, in its colours, red ones glittering", () => {
    const g = new Glitch(seeded());
    run(g, across(360), 0.3);
    const seam = 360 + 1000;
    for (const s of g.shapes) {
      expect(Math.abs((s.pts[0] ?? 0) - seam)).toBeLessThan(20);
      expect(Object.values(GLITCH_COLOURS)).toContain(s.fill);
      if (s.fill === GLITCH_COLOURS.red) expect(s.dots.length).toBeGreaterThan(0);
    }
  });

  it("the island leaving the edge, the spikes stay on it and fade, then all is cleared", () => {
    const g = new Glitch(seeded());
    run(g, across(360), 0.3);
    // Gone far to the right: no edge through the island any more.
    const away = across(null, 900);
    g.step(GLITCH_STEP, away);
    expect(g.shapes.length).toBeGreaterThan(0);
    for (const s of g.shapes) expect(Math.abs((s.pts[0] ?? 0) - 1360)).toBeLessThan(20);
    expect(run(g, away, 2)).toBe(false);
    expect(g.take()).toEqual([]);
  });

  it("resting across two screens, it goes on quietly with bursts now and then", () => {
    const g = new Glitch(seeded());
    run(g, across(360), 0.5);
    let low = 1;
    let high = 0;
    for (let t = 0; t < 8; t += GLITCH_STEP) {
      expect(g.step(GLITCH_STEP, across(360), true)).toBe(true);
      low = Math.min(low, g.level);
      high = Math.max(high, g.level);
    }
    expect(low).toBeLessThan(0.4);
    expect(high).toBeGreaterThan(0.6);
  });

  it("docking or tearing off, the top edge glitches, its spikes going down only", () => {
    const g = new Glitch(seeded());
    g.trigger({ vertical: false, at: 0, from: 1100, to: 1400, sides: 1 });
    expect(g.step(1 / 60, across(null))).toBe(true);
    expect(g.shapes.length).toBeGreaterThan(4);
    for (const s of g.shapes) {
      expect(Math.abs(s.pts[1] ?? 1)).toBeLessThan(20);
      expect(s.pts[7] ?? 0).toBeGreaterThan(0);
    }
  });
});
