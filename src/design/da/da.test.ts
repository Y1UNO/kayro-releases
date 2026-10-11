import { describe, expect, it } from "vitest";
import { presetSlug } from "../../../vite/atelier";
import croquis from "../presets/croquis-12.json";
import v4 from "../presets/v4-cristal.json";
import active from "./active.json";
import { CATALOGUE } from "./catalogue";
import {
  cardGeometry,
  daVariables,
  defaultValues,
  parsePreset,
  parseValues,
  SKETCH_GEOMETRY,
} from "./values";

describe("art direction catalogue", () => {
  it("has unique element ids and unique parameter keys per element", () => {
    expect(new Set(CATALOGUE.map((e) => e.id)).size).toBe(CATALOGUE.length);
    for (const el of CATALOGUE) {
      const keys = el.params.map((p) => p.key);
      expect(new Set(keys).size, el.id).toBe(keys.length);
      expect(keys, el.id).not.toContain("on");
    }
  });

  it("has every default within its bounds and options", () => {
    for (const el of CATALOGUE) {
      for (const p of el.params) {
        if (p.kind === "range") {
          expect(p.default, `${el.id}.${p.key}`).toBeGreaterThanOrEqual(p.min);
          expect(p.default, `${el.id}.${p.key}`).toBeLessThanOrEqual(p.max);
        }
        if (p.kind === "select") expect(p.options).toContain(p.default);
      }
    }
    expect(parseValues(defaultValues()).ok).toBe(true);
  });

  it("keeps the brief's limits: card tilt at most 3°, at most 40 particles", () => {
    const param = (id: string, key: string) =>
      CATALOGUE.find((e) => e.id === id)?.params.find((p) => p.key === key);
    expect(param("cardHover", "tilt")).toMatchObject({ max: 3 });
    expect(param("embers", "count")).toMatchObject({ max: 40 });
    expect(param("stars", "count")).toMatchObject({ max: 40 });
  });

  it("writes CSS variables only (custom properties)", () => {
    for (const name of Object.keys(daVariables(defaultValues()))) expect(name).toMatch(/^--/);
  });

  it("falls back to the sketch geometry when the cards element is off", () => {
    const v = defaultValues();
    expect(cardGeometry(v.cards)).toEqual({ activeW: 240, activeH: 336, sideW: 176, gap: 22 });
    expect(cardGeometry({ ...v.cards!, on: false })).toEqual(SKETCH_GEOMETRY);
  });
});

describe("parseValues / parsePreset (untrusted JSON)", () => {
  it("fills missing elements with defaults and lists unknown ones", () => {
    const r = parseValues({ gone: { x: 1 }, cards: { radius: 20, old: 3 } });
    expect(r.ok && r.values.cards?.radius).toBe(20);
    expect(r.ok && r.values.stars).toEqual(defaultValues().stars);
    expect(r.ok && r.dropped).toEqual(["gone", "cards.old"]);
  });

  it.each([
    ["not an object", 3],
    ["out of bounds", { cards: { radius: 999 } }],
    ["wrong type", { cardHover: { tilt: "2" } }],
    ["unknown option", { typography: { pair: "comic" } }],
    ["bad colour", { embers: { color: "url(x)" } }],
    ["bad switch", { stars: { on: "yes" } }],
  ])("rejects %s", (_l, raw) => {
    expect(parseValues(raw).ok).toBe(false);
  });

  it("accepts the shipped presets and active.json", () => {
    for (const p of [v4, croquis, active]) expect(parsePreset(p).ok).toBe(true);
  });

  it.each([
    ["unknown key", { ...v4, script: "x" }],
    ["bad theme id", { ...v4, themeId: "../x" }],
    ["bad date", { ...v4, savedAt: "never" }],
    ["long name", { ...v4, name: "x".repeat(61) }],
  ])("rejects a preset with %s", (_l, raw) => {
    expect(parsePreset(raw).ok).toBe(false);
  });
});

describe("preset file names (dev server)", () => {
  it("keeps only lower-case ASCII, digits and dashes", () => {
    expect(presetSlug("V4 Cristal")).toBe("v4-cristal");
    expect(presetSlug("Piste été")).toBe("piste-ete");
    expect(presetSlug("../../etc/passwd")).toBe("etc-passwd");
    expect(presetSlug("..\\..\\x")).toBe("x");
    expect(presetSlug("///")).toBeNull();
  });
});
