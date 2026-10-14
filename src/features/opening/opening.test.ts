import { describe, expect, it } from "vitest";
import { CATALOGUE, defaultValues, parsePreset } from "../../design/da";
import { sameIntro } from "../../fx/gpu/cues";
import { introUniforms, kindUniform } from "../../fx/gpu/uniforms";
import { skipsOpening } from "./runOpening";
import {
  letterOffsets,
  openingAt,
  openingDuration,
  openingRestAt,
  openingSettings,
  type OpeningGeometry,
} from "./openingTimeline";

const S = openingSettings(defaultValues().opening);
const G: OpeningGeometry = {
  logo: { x: 490, y: 316 },
  slide: 150,
  letters: [-127, -183, -234, -279, -326],
};

describe("opening V1-A timeline", () => {
  it("default values are the spec's", () => {
    expect(S).toMatchObject({
      speed: 1,
      slideMs: 650,
      letterDelay: 85,
      letterMs: 800,
      letterScale: 0.45,
      letterBlur: 6,
      ringRadius: 200,
    });
    expect(openingRestAt(S)).toBe(3400);
    expect(openingDuration(S)).toBe(3400 + S.hold + S.handoff);
  });

  it("starts on a dark page with nothing drawn and the home screen hidden", () => {
    const f = openingAt(0, S, G);
    expect(f.intro.fade).toBe(0);
    expect(f.intro.home).toBe(0);
    expect(f.intro.ring[3]).toBe(1); // ring visible…
    expect(f.intro.draw[0]).toBe(0); // …but not drawn yet
    expect(f.logo.o).toBe(0);
    expect(f.letters.every((l) => l.o === 0)).toBe(true);
    expect(f.home).toBe(0);
    expect(f.content).toBe(1);
  });

  it("follows the base V1 key times", () => {
    expect(openingAt(700, S, G).intro.fade).toBe(1);
    expect(openingAt(1300, S, G).intro.draw[0]).toBe(1); // ring drawn at 200 + 1 100
    expect(openingAt(1749, S, G).logo.x).toBe(150); // the logo waits, centred
    const out = openingAt(2600, S, G);
    expect(out.intro.ring[3]).toBe(0); // ring widened ×1.4 and faded
    expect(out.intro.ring[2]).toBeCloseTo(280);
    expect(openingAt(2400, S, G).logo.x).toBe(0); // slide over at 1 750 + 650
    expect(openingAt(2499, S, G).intro.embers).toBe(0);
    expect(openingAt(3400, S, G).sub.o).toBe(1);
  });

  it("letters leave every 85 ms from the logo's centre, small and blurred", () => {
    const at = (t: number) => openingAt(t, S, G).letters;
    expect(at(2000)[0]).toMatchObject({ o: 0, x: -127, scale: 0.45, blur: 1 });
    expect(at(2084)[1]!.o).toBe(0);
    expect(at(2086)[1]!.o).toBeGreaterThan(0);
    // Fully opaque from 30 % of its course, in place and sharp at the end.
    expect(at(2000 + 240)[0]!.o).toBe(1);
    const last = at(2000 + 4 * 85 + 800)[4]!;
    expect(last).toMatchObject({ o: 1, scale: 1, blur: 0 });
    expect(Math.abs(last.x)).toBe(0);
  });

  it("letter offsets come from the real positions (≈ the mock-up's)", () => {
    // Mock-up: logo centre 490, letters K a y r o centred at about 617 … 816.
    expect(letterOffsets(490, [617, 673, 724, 769, 816])).toEqual([-127, -183, -234, -279, -326]);
  });

  it("hands off: the opening fades out first, then the home screen comes in", () => {
    const rest = openingRestAt(S) + S.hold;
    const early = openingAt(rest + S.handoff * 0.2, S, G);
    expect(early.content).toBeLessThan(1);
    expect(early.home).toBe(0);
    const end = openingAt(openingDuration(S), S, G);
    expect(end.content).toBe(0);
    expect(end.home).toBe(1);
    expect(end.intro.home).toBe(1);
  });

  it("speed scales every time", () => {
    const fast = { ...S, speed: 2 };
    expect(openingRestAt(fast)).toBe(1700);
    expect(openingAt(650, fast, G).intro.draw[0]).toBe(1);
  });
});

describe("opening in the catalogue and the engine", () => {
  it("the element is on by default and older presets still load", () => {
    expect(CATALOGUE.find((e) => e.id === "opening")?.defaultOn).toBe(true);
    const r = parsePreset({
      schemaVersion: 1,
      name: "vieux",
      savedAt: "2026-10-11T00:00:00Z",
      themeId: "bleu-gris",
      values: {},
    });
    expect(r.ok && r.preset.values.opening?.slideMs).toBe(650);
  });

  it("no opening = neutral uniforms (nothing drawn, every particle kind at 1)", () => {
    expect(introUniforms(null)).toMatchObject({ uIntro: 1, uIRing: [0, 0, 1, 0] });
    expect(kindUniform(null)).toEqual([1, 1, 1]);
    const f = openingAt(1000, S, G).intro;
    expect(kindUniform(f)).toEqual([f.embers, f.fade, f.fade * f.home]);
  });

  it("the engine redraws only when the opening's picture changes", () => {
    expect(sameIntro(openingAt(5, S, G).intro, openingAt(5, S, G).intro)).toBe(true);
    expect(sameIntro(openingAt(5, S, G).intro, openingAt(600, S, G).intro)).toBe(false);
    expect(sameIntro(null, null)).toBe(true);
  });

  it("only a click, Escape, Enter or Space skips it: Tab and the other keys pass (review B6)", () => {
    expect(skipsOpening({ type: "pointerdown" })).toBe(true);
    for (const key of ["Escape", "Enter", " "])
      expect(skipsOpening({ type: "keydown", key })).toBe(true);
    for (const key of ["Tab", "Shift", "ArrowRight", "a"]) {
      expect(skipsOpening({ type: "keydown", key })).toBe(false);
    }
  });
});
