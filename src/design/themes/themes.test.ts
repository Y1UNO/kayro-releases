import { describe, expect, it } from "vitest";
import { themeVariables } from "../applyTheme";
import { parseTheme } from "../theme";
import { BUILTIN_THEMES, DEFAULT_THEME } from "./index";
import boreale from "./boreale.json";

describe("built-in themes", () => {
  it("are the 6 logo themes then the 5 older ones, Lavande-pêche first", () => {
    expect(BUILTIN_THEMES.map((t) => t.id)).toEqual([
      "lavande-peche",
      "mauve",
      "sakura",
      "bleu-gris",
      "opale",
      "cuivre",
      "crepuscule",
      "boreale",
      "ocean",
      "rose",
      "graphite",
    ]);
    expect(DEFAULT_THEME.id).toBe("lavande-peche");
  });

  it("have unique ids and a variable for every field", () => {
    expect(new Set(BUILTIN_THEMES.map((t) => t.id)).size).toBe(11);
    for (const t of BUILTIN_THEMES) {
      expect(Object.keys(themeVariables(t)).sort()).toEqual(
        [
          "--accent",
          "--beam",
          "--bg-bottom",
          "--bg-mid",
          "--bg-top",
          "--card",
          "--fog-a",
          "--fog-b",
          "--fog-c",
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
    expect(parseTheme(boreale).ok).toBe(true);
  });

  it.each([
    ["not an object", 42],
    ["unknown key", { ...boreale, script: "alert(1)" }],
    ["bad version", { ...boreale, schemaVersion: 2 }],
    ["bad colour", { ...boreale, accent: "url(javascript:x)" }],
    ["bad bg length", { ...boreale, bg: ["#000", "#111"] }],
    ["bad rgb range", { ...boreale, card: [0, 0, 999] }],
    ["bad id", { ...boreale, id: "../etc" }],
    ["bad gradient", { ...boreale, gradient: ["#fff"] }],
    ["bad soft colour", { ...boreale, soft: "expression(x)" }],
    ["huge name", { ...boreale, name: "x".repeat(500) }],
  ])("rejects %s", (_label, raw) => {
    expect(parseTheme(raw).ok).toBe(false);
  });
});
