import { describe, expect, it } from "vitest";
import type { FxPalette } from "../FxLayer";
import { CUSTOM_MOODS } from "./custom";
import { MAX_MOOD_SPRITES, MOOD_FADE, MOOD_KIND, MoodSim } from "./moodSim";
import { MOOD_PACKS, PACK_IDS } from "./packs";
import type { Mood, MoodLayerDef } from "./types";

const PAL: FxPalette = {
  beam: [1, 1, 1],
  fog: ["", "", ""],
  a: [200, 150, 120],
  b: [120, 140, 220],
};
const FOCUS = { x: 700, top: 240, bottom: 578 };

/** The core's limits (src-tauri/src/config/moods.rs): the built-in ambiences must pass them too. */
function check(m: Mood): string | null {
  const within = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;
  const pair = (r: readonly [number, number], lo: number, hi: number) =>
    within(r[0], lo, hi) && within(r[1], lo, hi) && r[0] <= r[1];
  if (!/^[a-z0-9-]{1,40}$/.test(m.id) || m.name.length === 0 || m.name.length > 80) return "header";
  const glyphs = Object.entries(m.glyphs);
  if (glyphs.length > 8) return "glyphs";
  for (const [, d] of glyphs)
    if (!/^[Mm][MmLlHhVvCcSsQqTtAaZz0-9.,\s+eE-]*$/.test(d) || d.length > 1500) return `path ${d}`;
  if (m.layers.length < 1 || m.layers.length > 6) return "layers";
  const glyph = (g: string | null | undefined) => g != null && g in m.glyphs;
  for (const l of m.layers as MoodLayerDef[]) {
    const ok =
      l.type === "particles"
        ? within(l.count, 1, 80) &&
          pair(l.size, 0.5, 60) &&
          pair(l.speed, 0, 400) &&
          pair(l.life, 0.5, 60) &&
          within(l.drift, 0, 1) &&
          within(l.opacity, 0, 1) &&
          (l.shape !== "glyph" || glyph(l.glyph))
        : l.type === "glyphRing"
          ? within(l.count, 1, 24) &&
            within(l.radius, 0.1, 0.6) &&
            within(l.rotation, -90, 90) &&
            within(l.size, 4, 80) &&
            within(l.opacity, 0, 1) &&
            glyph(l.glyph)
          : l.type === "mist"
            ? within(l.count, 1, 6) && within(l.opacity, 0, 0.6) && within(l.speed, 0, 60)
            : l.type === "beam"
              ? within(l.count, 1, 4) && within(l.sway, 0, 20) && within(l.opacity, 0, 1)
              : within(l.period, 1, 20) && within(l.opacity, 0, 1);
    if (!ok) return `layer ${l.type}`;
  }
  return null;
}

function run(sim: MoodSim, ms: number, step = 16): void {
  for (let t = 0; t < ms; t += step) sim.step(step);
}

const fill = (sim: MoodSim) => {
  const out = new Float32Array(MAX_MOOD_SPRITES * 8);
  const n = sim.fill(out, 0, MAX_MOOD_SPRITES, PAL, 1400, 860, 1);
  return { out, n };
};

describe("ambiences (steps 16–17)", () => {
  it("built-in and made-to-measure ambiences pass the core's limits", () => {
    for (const m of [...MOOD_PACKS, ...CUSTOM_MOODS]) expect(check(m), m.id).toBeNull();
    expect(PACK_IDS).toEqual(["aucune", "braises", "etoiles", "brume", "runes", "pluie"]);
    const ids = [...MOOD_PACKS, ...CUSTOM_MOODS].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("perso-")).toBe(false);
  });

  it("fades a new ambience in, and draws nothing in Eco", () => {
    const sim = new MoodSim();
    sim.configure("high", false);
    sim.set({ mood: MOOD_PACKS[0]!, density: 1, speed: 1 });
    expect(fill(sim).n).toBe(0); // alpha 0 at the start of the fade
    run(sim, MOOD_FADE.in + 50);
    expect(fill(sim).n).toBeGreaterThan(20);
    expect(sim.animated).toBe(true);
    sim.configure("eco", false);
    expect(fill(sim).n).toBe(0);
    expect(sim.active).toBe(false);
  });

  it("crosses from one ambience to another, then to none", () => {
    const sim = new MoodSim();
    sim.configure("high", false);
    sim.set({ mood: MOOD_PACKS[0]!, density: 1, speed: 1 });
    run(sim, 800);
    const v = sim.version;
    sim.set({ mood: MOOD_PACKS[3]!, density: 1, speed: 1 });
    run(sim, MOOD_FADE.out - 50);
    expect(sim.version).toBe(v); // still the old one, fading out
    run(sim, 100 + MOOD_FADE.in);
    expect(sim.version).toBe(v + 1);
    expect(sim.glyphs).toEqual(["stave", "key", "arch"]);
    sim.set(null);
    run(sim, MOOD_FADE.out + 50);
    expect(sim.active).toBe(false);
  });

  it("density scales the particles, the dosage alone never fades", () => {
    const sim = new MoodSim();
    sim.configure("high", false);
    const mood = MOOD_PACKS[4]!; // Pluie: 70 streaks
    sim.set({ mood, density: 1, speed: 1 });
    run(sim, 800);
    const one = fill(sim).n;
    sim.set({ mood, density: 0.5, speed: 2 });
    expect(fill(sim).n).toBeLessThan(one * 0.7);
  });

  it("hangs the ring and the pulse on the focus target, still with reduced motion", () => {
    const sim = new MoodSim();
    sim.configure("high", true);
    sim.set({ mood: MOOD_PACKS[3]!, density: 1, speed: 1 });
    expect(sim.animated).toBe(false);
    sim.step(16);
    const kinds = (s: MoodSim) => {
      const { out, n } = fill(s);
      return Array.from({ length: n }, (_, i) => out[i * 8 + 7]!);
    };
    expect(kinds(sim)).not.toContain(MOOD_KIND.ring); // no focus: nothing on it
    sim.focus = FOCUS;
    sim.step(16);
    expect(kinds(sim)).toContain(MOOD_KIND.ring);
    const { out, n } = fill(sim);
    for (let i = 0; i < n; i++) {
      expect(Number.isFinite(out[i * 8]!) && Number.isFinite(out[i * 8 + 1]!)).toBe(true);
      expect(out[i * 8 + 3]!).toBeLessThanOrEqual(1);
    }
  });
});
