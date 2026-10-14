import { describe, expect, it } from "vitest";
import { defaultValues } from "../../design/da";
import { OPENING_C } from "../../design/motion/tokens4b";
import { sameIntro } from "../../fx/gpu/cues";
import { introVeilUniform } from "../../fx/gpu/uniforms";
import { revealAt, veilUniform } from "./openingReveal";
import { openingAt, openingSettings, type OpeningGeometry } from "./openingTimeline";

const C = openingSettings(defaultValues().opening);
const V1A = { ...C, pulse: "v1a" };
const G: OpeningGeometry = {
  logo: { x: 490, y: 316 },
  slide: 150,
  letters: [-127, -183, -234, -279, -326],
};
const VIEW = { w: 1280, h: 760 };
// The ring is centred on the window (640, 316): the farthest corner is a bottom one.
const COVER = Math.hypot(640, 760 - 316);

describe("opening variant C in the opaque opening (round 4b)", () => {
  it("is on by default, with the spec's veil; V1-A's timeline is unchanged", () => {
    expect(C).toMatchObject({ pulse: "c", veil: OPENING_C.veil, wave: OPENING_C.wave });
    expect(openingSettings(undefined).pulse).toBe("c");
    expect(revealAt(2000, V1A, G, VIEW, false)).toBeNull();
    expect(openingAt(2000, C, G)).toEqual(openingAt(2000, V1A, G));
  });

  it("shows the page only in the ring, darkened around, until the ringOut", () => {
    for (const t of [0, 950, 1749]) {
      expect(revealAt(t, C, G, VIEW, false)).toEqual({
        veil: OPENING_C.veil,
        x: 640,
        y: 316,
        r: 200 + OPENING_C.ringMargin,
        wave: 0,
      });
    }
  });

  it("opens with the ringOut itself: same instant, same progress, whole page at its end", () => {
    const mid = revealAt(2100, C, G, VIEW, false)!;
    const ring = openingAt(2100, C, G).intro.ring;
    const out = (ring[2] / 200 - 1) / 0.4; // the ringOut's progress (× 1.4 at its end)
    expect(mid.r).toBeCloseTo(216 + (COVER - 216) * out, 6);
    expect(mid.wave).toBe(C.wave);
    const end = revealAt(1750 + 850, C, G, VIEW, false)!;
    expect(end.r).toBeCloseTo(COVER, 6);
    expect(end.veil).toBe(0);
    expect(end.wave).toBe(0);
  });

  it("the wave is full until 80 % of the pulse, then fades out", () => {
    const at = (u: number) => {
      // Time at which the ringOut's eased progress reaches u (bisection on the curve).
      let lo = 1750;
      let hi = 2600;
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2;
        const o = (openingAt(m, C, G).intro.ring[2] / 200 - 1) / 0.4;
        if (o < u) lo = m;
        else hi = m;
      }
      return revealAt(hi, C, G, VIEW, false)!.wave;
    };
    expect(at(0.79)).toBe(C.wave);
    expect(at(0.9)).toBeCloseTo(C.wave * 0.5, 2);
  });

  it("has no wave in Eco, keeps the reveal; follows the speed", () => {
    const eco = revealAt(2100, C, G, VIEW, true)!;
    expect(eco.wave).toBe(0);
    expect(eco.r).toBe(revealAt(2100, C, G, VIEW, false)!.r);
    const fast = { ...C, speed: 2 };
    expect(revealAt(2600 / 2, fast, G, VIEW, false)!.veil).toBe(0);
    expect(revealAt(1749 / 2, fast, G, VIEW, false)!.r).toBe(216);
  });
});

describe("variant C's veil drawn by the engine (review C)", () => {
  it("the uniform is the CSS layer's circle and opacity, none once the page is whole", () => {
    const rv = revealAt(2050, C, G, VIEW, false)!;
    expect(veilUniform(rv)).toEqual([rv.x, rv.y, rv.r, OPENING_C.veil]);
    expect(veilUniform(revealAt(2600, C, G, VIEW, false))).toEqual([0, 0, 0, 0]);
    expect(veilUniform(revealAt(2000, V1A, G, VIEW, false))).toEqual([0, 0, 0, 0]);
    expect(introVeilUniform(null)).toEqual({ uIVeil: [0, 0, 0, 0] });
  });

  it("the engine draws a new frame when only the veil's circle changes", () => {
    const intro = openingAt(2050, C, G).intro;
    const a = { ...intro, veil: veilUniform(revealAt(2050, C, G, VIEW, false)) };
    const b = { ...intro, veil: veilUniform(revealAt(2100, C, G, VIEW, false)) };
    expect(sameIntro(a, { ...a })).toBe(true);
    expect(sameIntro(a, b)).toBe(false);
    expect(sameIntro(intro, { ...intro, veil: [0, 0, 0, 0] })).toBe(true);
  });
});
