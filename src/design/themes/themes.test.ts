import { describe, expect, it } from "vitest";
import { themeVariables } from "../applyTheme";
import { parseTheme } from "../theme";
import { BUILTIN_THEMES, DEFAULT_THEME, PICKER_THEMES, resolveTheme } from "./index";
import cuivre from "./cuivre.json";

describe("built-in themes", () => {
  it("are the 6 logo themes, Bleu-gris first, all offered in the settings", () => {
    expect(BUILTIN_THEMES.map((t) => t.id)).toEqual([
      "bleu-gris",
      "lavande-peche",
      "encre",
      "sakura",
      "opale",
      "cuivre",
    ]);
    expect(DEFAULT_THEME.id).toBe("bleu-gris");
    expect(PICKER_THEMES.map((t) => t.id)).toEqual([
      "bleu-gris",
      "lavande-peche",
      "encre",
      "sakura",
      "opale",
      "cuivre",
    ]);
  });

  it("resolve renamed, retired and unknown ids", () => {
    expect(resolveTheme("mauve").id).toBe("encre");
    for (const old of ["crepuscule", "boreale", "ocean", "rose", "graphite"])
      expect(resolveTheme(old).id).toBe("bleu-gris");
    expect(resolveTheme("opale").id).toBe("opale");
    expect(resolveTheme("nope").id).toBe("bleu-gris");
    expect(resolveTheme(undefined).id).toBe("bleu-gris");
  });

  it("have unique ids and a variable for every field", () => {
    expect(new Set(BUILTIN_THEMES.map((t) => t.id)).size).toBe(6);
    for (const t of BUILTIN_THEMES) {
      expect(Object.keys(themeVariables(t)).sort()).toEqual(
        [
          "--accent",
          "--bg-bottom",
          "--bg-mid",
          "--bg-top",
          "--card",
          "--glow",
          "--grad-a",
          "--grad-b",
          "--text-soft",
        ].sort(),
      );
    }
  });
});

describe("parseTheme (untrusted input)", () => {
  it("accepts a valid theme", () => {
    expect(parseTheme(cuivre).ok).toBe(true);
  });

  it.each([
    ["not an object", 42],
    ["unknown key", { ...cuivre, script: "alert(1)" }],
    ["bad version", { ...cuivre, schemaVersion: 2 }],
    ["bad colour", { ...cuivre, accent: "url(javascript:x)" }],
    ["bad bg length", { ...cuivre, bg: ["#000", "#111"] }],
    ["bad rgb range", { ...cuivre, card: [0, 0, 999] }],
    ["bad id", { ...cuivre, id: "../etc" }],
    ["bad gradient", { ...cuivre, gradient: ["#fff"] }],
    ["bad soft colour", { ...cuivre, soft: "expression(x)" }],
    ["huge name", { ...cuivre, name: "x".repeat(500) }],
  ])("rejects %s", (_label, raw) => {
    expect(parseTheme(raw).ok).toBe(false);
  });
});
