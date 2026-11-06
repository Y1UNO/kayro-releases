import { describe, expect, it } from "vitest";
import { CAPRI, spikes, type Edge } from "./capri";

const seeded = () => {
  let seed = 11;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

describe("Capri (step 20)", () => {
  const top: Edge = { vertical: false, at: 100, from: 0, to: 300, sides: -1 };

  it("more and longer spikes as the level rises, all in Capri's colours", () => {
    const calm = spikes(top, 0, seeded());
    const loud = spikes(top, 1, seeded());
    expect(loud.length).toBeGreaterThan(calm.length);
    for (const s of loud) expect(Object.values(CAPRI)).toContain(s.fill);
  });

  it("spikes on one side of the edge go that way only", () => {
    for (const s of spikes(top, 1, seeded())) {
      // The tip (4th point) is above the edge: they go up, out of a card.
      expect(s.pts[7] ?? 0).toBeLessThan(100);
    }
  });
});
