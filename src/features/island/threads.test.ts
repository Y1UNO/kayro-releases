import { describe, expect, it } from "vitest";
import { COUNT, DOCK_ZONE, Threads, gapAt, reach } from "./threads";

const island = { x: 300, y: 150, width: 176 };
/** Always the middle: the same frame each time. */
const half = () => 0.5;
/** A fixed sequence, for threads that differ (but no flicker: never under 0.1). */
function seeded(): () => number {
  let x = 7;
  return () => 0.1 + 0.9 * ((x = (x * 16807) % 2147483647) / 2147483647);
}
const ys = (pts: number[]) => pts.filter((_, i) => i % 2 === 1);

function fly(t: Threads, near: number, secs: number): boolean {
  let shown = false;
  t.approach(near);
  for (let s = 0; s < secs; s += 1 / 120) shown = t.step(1 / 120, island);
  return shown;
}

describe("the docking threads (Capri, discreet)", () => {
  it("are nothing far from the top edge, and grown full at the touch", () => {
    expect(reach(0)).toBe(0);
    expect(reach(0.15)).toBe(0);
    expect(reach(1)).toBeCloseTo(1, 5);
    expect(gapAt(0)).toBe(DOCK_ZONE);
    expect(gapAt(1)).toBe(0);
    const t = new Threads(half);
    expect(fly(t, 0.05, 0.3)).toBe(false);
    expect(t.lines).toHaveLength(0);
  });

  it("join the edge and the island, whole, more of them as it nears", () => {
    const t = new Threads(seeded());
    fly(t, 0.5, 0.4);
    const few = t.lines.length;
    expect(fly(t, 0.9, 0.4)).toBe(true);
    expect(t.lines.length).toBeGreaterThan(few);
    expect(t.lines.length).toBeLessThanOrEqual(COUNT);
    const edge = island.y - gapAt(0.9);
    for (const line of t.lines) {
      expect(line.pts[1]).toBeCloseTo(edge, 5);
      expect(line.pts[line.pts.length - 1]).toBeCloseTo(island.y, 5);
      expect(Math.min(...ys(line.pts))).toBeGreaterThanOrEqual(edge - 0.01);
    }
    // Not all of the same thickness.
    expect(new Set(t.lines.map((l) => l.width)).size).toBeGreaterThan(1);
  });

  it("are crushed when the island touches, then gone", () => {
    const t = new Threads(half);
    fly(t, 0.95, 0.4);
    t.crush();
    expect(t.step(1 / 120, island)).toBe(true);
    expect(t.lines).toHaveLength(0);
    expect(t.sparks.length).toBeGreaterThan(0);
    // The sparks lie along the island's top.
    expect(t.sparks.every((s) => s[2] === island.y)).toBe(true);
    expect(fly(t, 0.95, 0.4)).toBe(false);
    expect(t.level).toBe(0);
    expect(t.sparks).toHaveLength(0);
  });

  it("leave nothing when the island goes away from the edge", () => {
    const t = new Threads(half);
    fly(t, 0.7, 0.3);
    expect(fly(t, 0, 1)).toBe(false);
    expect(t.lines).toHaveLength(0);
  });

  it("torn off, hold on taut while held, then snap back to both ends and go", () => {
    const t = new Threads(seeded());
    t.tear();
    expect(t.tearing).toBe(true);
    expect(fly(t, 0.4, 0.1)).toBe(true);
    expect(t.lines.length).toBeGreaterThan(COUNT / 2);
    const edge = island.y - gapAt(0.4);
    for (const line of t.lines) {
      expect(line.pts[1]).toBeCloseTo(edge, 5);
      expect(line.pts[line.pts.length - 1]).toBeCloseTo(island.y, 5);
    }
    // Pulled away: they break, the pieces each on their side.
    expect(fly(t, 0.02, 0.1)).toBe(true);
    expect(t.tearing).toBe(false);
    const gap = gapAt(0.02);
    for (const line of t.lines) {
      const y = ys(line.pts);
      const onEdge = Math.abs((y[0] ?? 0) - (island.y - gap)) < 0.01;
      const onIsland = Math.abs((y[y.length - 1] ?? 0) - island.y) < 0.01;
      expect(onEdge || onIsland).toBe(true);
      expect(Math.max(...y) - Math.min(...y)).toBeLessThan(gap);
    }
    expect(fly(t, 0, 0.3)).toBe(false);
    expect(t.lines).toHaveLength(0);
  });

  it("torn off and put back, are crushed like a docking", () => {
    const t = new Threads(seeded());
    t.tear();
    fly(t, 0.9, 0.1);
    t.crush();
    expect(t.step(1 / 120, island)).toBe(true);
    expect(t.sparks.length).toBeGreaterThan(0);
    expect(fly(t, 0, 0.3)).toBe(false);
  });
});
