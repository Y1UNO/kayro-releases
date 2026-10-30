import { describe, expect, it } from "vitest";
import { SOUND_DEFAULTS } from "../features/settings/settingsModel";
import { degreeRate, pickVariant } from "./engine";
import { cueGain, SILENT, type SoundPrefs } from "./gate";
import { cueLength, parseSoundManifest, SOUND_EVENTS, SOUND_PACKS } from "./manifest";
import manifestJson from "./sons.json";
import { peaks } from "./synth";

const ON: SoundPrefs = {
  on: true,
  pack: "premium",
  volume: 0.5,
  families: { interface: true, transitions: true, launch: true },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the test bends the JSON freely
const clone = () => JSON.parse(JSON.stringify(manifestJson)) as Record<string, any>;

describe("sounds (step 17b)", () => {
  it("the built-in manifest describes every moment in every style, all light", () => {
    const m = parseSoundManifest(manifestJson);
    const longest = { interface: 1.9, transitions: 2.2, launch: 4.5 };
    for (const p of SOUND_PACKS) {
      for (const e of SOUND_EVENTS) {
        expect(m.packs[p].cues[e].length).toBeGreaterThan(0);
        expect(cueLength(m.packs[p], e)).toBeLessThanOrEqual(longest[m.events[e].family]);
      }
    }
  });

  it("the opening's melody keeps the opening's rhythm (a note per letter, 85 ms apart)", () => {
    const m = parseSoundManifest(manifestJson);
    for (const p of SOUND_PACKS) {
      const starts = m.packs[p].cues.open[0]!.map((n) => n.at ?? 0);
      for (const at of [2.0, 2.085, 2.17, 2.255, 2.34]) expect(starts).toContain(at);
    }
  });

  it("climbs a pentatonic scale and never repeats a variant", () => {
    expect(degreeRate(0)).toBe(1);
    expect(degreeRate(5)).toBeCloseTo(2);
    expect(degreeRate(2)).toBeCloseTo(2 ** (4 / 12));
    expect(degreeRate(-1)).toBeCloseTo(2 ** (-3 / 12));
    for (const r of [0, 0.3, 0.6, 0.99]) expect(pickVariant(3, 1, r)).not.toBe(1);
    expect(pickVariant(1, 0, 0.5)).toBe(0);
  });

  it("refuses an unknown field, moment, style, wave or a number out of range", () => {
    const a = clone();
    a.events.click.loop = true;
    expect(() => parseSoundManifest(a)).toThrow(/champ inconnu/);
    const b = clone();
    b.events.voice = b.events.click;
    expect(() => parseSoundManifest(b)).toThrow(/inconnu/);
    const c = clone();
    c.packs.premium.cues.select[0].wave = "noise";
    expect(() => parseSoundManifest(c)).toThrow(/valeur inconnue/);
    const d = clone();
    d.packs.retro.cues.tab[0].gain = 3;
    expect(() => parseSoundManifest(d)).toThrow(/hors de/);
    const e = clone();
    delete e.packs.chiptune;
    expect(() => parseSoundManifest(e)).toThrow(/manquant/);
  });

  it("plays only when on, in its family, on screen, and not twice too fast", () => {
    const cue = parseSoundManifest(manifestJson).events.step;
    expect(cueGain(cue, SILENT, true, undefined, 0)).toBeNull();
    expect(cueGain(cue, ON, false, undefined, 0)).toBeNull();
    expect(
      cueGain(cue, { ...ON, families: { ...ON.families, interface: false } }, true, undefined, 0),
    ).toBeNull();
    expect(cueGain(cue, ON, true, 1000, 1000 + cue.minGapMs - 1)).toBeNull();
    expect(cueGain(cue, ON, true, 1000, 1000 + cue.minGapMs)).toBeCloseTo(cue.volume * 0.5);
    expect(cueGain(cue, { ...ON, volume: 0 }, true, undefined, 0)).toBeNull();
  });

  it("draws the wave as peaks between 0 and 1", () => {
    const samples = new Float32Array([0, 0.5, -1, 0.25, 0.1, -0.05, 0, 0]);
    const out = peaks(samples, 4);
    [0.5, 1, 0.1, 0].forEach((v, i) => expect(out[i]).toBeCloseTo(v, 5));
  });

  it("the interface's defaults are the core's (crystal style, low volume)", () => {
    expect(SOUND_DEFAULTS).toMatchObject({
      soundsOn: true,
      soundPack: "premium",
      soundVolume: 0.4,
    });
  });
});
