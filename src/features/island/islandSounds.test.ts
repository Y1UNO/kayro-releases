import { describe, expect, it } from "vitest";
import { HUM_SECONDS, crushed, glitchHum, glitchVoice, join, noise, stutter } from "./glitchVoice";
import { FORCE_FX, ISLAND_NOTES, ISLAND_SOUNDS } from "./islandSounds";

const RATE = 48_000;
const seeded = () => {
  let seed = 3;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

describe("Kysland's own sounds (step 20)", () => {
  it("« Forcer »: glassy notes for each moment, within the synthesiser's bounds", () => {
    for (const sound of ISLAND_SOUNDS) {
      const notes = ISLAND_NOTES.force[sound];
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.freq).toBeGreaterThanOrEqual(40);
        expect(n.freq).toBeLessThanOrEqual(8000);
        expect(n.gain).toBeLessThanOrEqual(0.5);
      }
    }
    expect(FORCE_FX.echo).toBeDefined();
  });

  it("« Glitch »: each moment is a short sound made sample by sample, never clipping", () => {
    for (const sound of ISLAND_SOUNDS) {
      const s = glitchVoice(sound, RATE, seeded());
      expect(s.length / RATE).toBeGreaterThan(0.02);
      expect(s.length / RATE).toBeLessThan(0.4);
      expect(Math.max(...s.map(Math.abs))).toBeLessThanOrEqual(1);
      expect(s.some((x) => Math.abs(x) > 0.2)).toBe(true);
    }
  });

  it("its parts: crushed tones have few levels, noise is held, a stutter repeats", () => {
    const tone = crushed(RATE, 0.05, 300, 900, 4, 6);
    expect(new Set(tone).size).toBeLessThanOrEqual(5);
    const n = noise(RATE, 0.01, 8, seeded());
    expect(n[0]).toBe(n[7]);
    const st = stutter(tone, RATE, 0.01, 3);
    const len = Math.round(0.01 * RATE);
    expect(st.length).toBe(len * 3);
    expect(st[5]).toBe(st[len + 5]);
    const joined = join(RATE, [[tone, 1]]);
    expect(joined[0]).toBe(0);
    expect(joined[joined.length - 1]).toBe(0);
  });

  it("varies a little each time it plays", () => {
    const a = glitchVoice("cross", RATE);
    const b = glitchVoice("cross", RATE);
    expect(a.length === b.length && a.every((x, i) => x === b[i])).toBe(false);
  });

  it("the hum across two screens loops seamlessly and stays quiet", () => {
    const hum = glitchHum(RATE, seeded());
    expect(hum.length).toBe(Math.round(HUM_SECONDS * RATE));
    expect(Math.max(...hum.map(Math.abs))).toBeLessThanOrEqual(1);
    // The drone ends where it starts: no click at the loop.
    expect(Math.abs((hum[hum.length - 1] ?? 0) - (hum[0] ?? 0))).toBeLessThan(0.3);
    expect(hum.some((x) => Math.abs(x) > 0.15)).toBe(true);
  });
});
