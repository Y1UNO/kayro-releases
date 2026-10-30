import { describe, expect, it } from "vitest";
import { SOUND_DEFAULTS } from "../features/settings/settingsModel";
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
  it("the built-in manifest describes every moment in every style", () => {
    const m = parseSoundManifest(manifestJson);
    for (const p of SOUND_PACKS) {
      for (const e of SOUND_EVENTS) {
        expect(m.packs[p].cues[e].length).toBeGreaterThan(0);
        // Light: nothing rings long (the launch, echo included, under 2.6 s).
        expect(cueLength(m.packs[p], e)).toBeLessThanOrEqual(e === "launch" ? 2.6 : 1.7);
      }
    }
  });

  it("refuses an unknown field, moment, style, wave or a number out of range", () => {
    const a = clone();
    a.events.click.loop = true;
    expect(() => parseSoundManifest(a)).toThrow(/champ inconnu/);
    const b = clone();
    b.events.voice = b.events.click;
    expect(() => parseSoundManifest(b)).toThrow(/inconnu/);
    const c = clone();
    c.packs.premium.cues.click[0].wave = "noise";
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
