import { describe, expect, it } from "vitest";
import { CUSTOM_MOODS } from "../../fx/mood/custom";
import { TIMING } from "./cinema/scene";
import { RUNES, SEAL } from "./seal";
import { back, finaleStart, sealFrame } from "./sealTimeline";

describe("launch sequence « Sceau », 2nd version (30/10)", () => {
  it("waits for the game's window, between the minimum and the 10 s ceiling", () => {
    const last = TIMING.ceiling - SEAL.finale.ms;
    expect(finaleStart(null, null)).toBe(last);
    expect(finaleStart(1200, null)).toBe(TIMING.minHold); // up early: the scene still plays out
    expect(finaleStart(6000, null)).toBe(6000 + TIMING.landedGrace);
    expect(finaleStart(9900, null)).toBe(last); // never past the ceiling
    expect(finaleStart(null, 2500)).toBe(2500); // skipped
    expect(finaleStart(null, 2500) + SEAL.finale.ms).toBeLessThanOrEqual(TIMING.ceiling);
  });

  it("opens over the card, builds the circle, the seal, the flames, then ends black", () => {
    const at0 = sealFrame(0, null, null);
    expect(at0.cover).toBe(0);
    expect(at0.card.z).toBe(0); // the first frame lies exactly over the card
    expect(at0.flames.every((g) => g === 0)).toBe(true);
    const mid = sealFrame(4000, null, null);
    expect(mid.cover).toBe(1);
    expect(mid.ground.draw).toBe(1);
    expect(mid.seal.alpha).toBe(1);
    expect(Math.min(...mid.flames)).toBeGreaterThan(0.9);
    expect(mid.fire).toBeGreaterThan(0.9);
    expect(mid.done).toBe(false);
    const end = sealFrame(TIMING.minHold + SEAL.finale.ms, 1000, null);
    expect(end.done).toBe(true);
    expect(end.black).toBe(1);
    expect(end.card.burn).toBe(1);
    expect(end.seal.alpha).toBe(0);
  });

  it("a skip before the fire still lights every flame in the finale", () => {
    const f = sealFrame(1500 + 400, null, 1500);
    expect(Math.min(...f.flames)).toBeGreaterThan(0.9);
    expect(sealFrame(1500 + SEAL.finale.ms, null, 1500).done).toBe(true);
  });

  it("flames catch with a little overshoot, then settle", () => {
    expect(back(0)).toBe(0);
    expect(back(1)).toBeCloseTo(1, 5);
    expect(Math.max(...[0.6, 0.7, 0.8].map(back))).toBeGreaterThan(1.02);
  });

  it("eight original runes; the Hades II ambience asks for the seal", () => {
    expect(RUNES).toHaveLength(8);
    for (const d of RUNES) expect(d).toMatch(/^M[\d .MLQAZ-]*$/);
    expect(CUSTOM_MOODS.find((m) => m.id === "sceau-sorciere")?.launch).toBe("seal");
  });
});
