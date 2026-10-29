import { describe, expect, it } from "vitest";
import { chromaOf, hexToLab, labToHex, type Lab } from "../../lib/oklab";
import { parseTheme } from "../theme";
import { deriveTheme, readable, recipeOf, TINT_DEFAULT } from "./derive";
import { BUILTIN_THEMES } from ".";

const hue = (deg: number, l = 0.75, c = 0.12): string => {
  const h = (deg * Math.PI) / 180;
  return labToHex([l, c * Math.cos(h), c * Math.sin(h)] as Lab);
};
const gap = (p: string, q: string) => {
  const [a, b] = [hexToLab(p), hexToLab(q)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

describe("« Créer mon thème »: a whole theme from A, B and the background", () => {
  it("every pick gives a valid, readable theme (hue sweep, extremes, both ends of the tint)", () => {
    const picks = [
      ...Array.from({ length: 24 }, (_, i) => hue(i * 15)),
      "#000000",
      "#ffffff",
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#808080",
      "#ffff00",
    ];
    for (const a of picks)
      for (const b of [picks[(picks.indexOf(a) + 5) % picks.length]!, "#ffffff", "#000000"])
        for (const tint of [0, TINT_DEFAULT, 1]) {
          const t = deriveTheme("perso-x", { name: "X", a, b, tint });
          expect(parseTheme(t).ok, `${a} ${b} ${tint}`).toBe(true);
          expect(readable(t), `${a} ${b} ${tint}`).toBe(true);
        }
  });

  it("replays the built-in rule: Bleu-gris from its own A and B lands next to Bleu-gris", () => {
    const bg = BUILTIN_THEMES[0]!;
    const t = deriveTheme("perso-x", {
      name: "B",
      a: bg.gradient![0],
      b: bg.gradient![1],
      tint: 0.8,
    });
    expect(t.accent.toLowerCase()).toBe(bg.accent.toLowerCase());
    for (let i = 0; i < 3; i++) expect(gap(t.bg[i]!, bg.bg[i]!)).toBeLessThan(0.02);
    expect(gap(t.soft!, bg.soft!)).toBeLessThan(0.03);
    // Through OKLab and back: one unit of rounding at most.
    t.card.forEach((v, i) => expect(Math.abs(v - bg.card[i]!)).toBeLessThanOrEqual(1));
    t.beam.forEach((v, i) => expect(Math.abs(v - bg.beam[i]!)).toBeLessThanOrEqual(1));
  });

  it("no neon: a pure red is calmed to the built-ins' chroma; the tint drives the background", () => {
    const t = deriveTheme("perso-x", { name: "R", a: "#ff0000", b: "#ff0000", tint: 1 });
    expect(chromaOf(hexToLab(t.accent))).toBeLessThanOrEqual(0.121);
    const ink = deriveTheme("perso-x", { name: "R", a: "#ff0000", b: "#ff0000", tint: 0 });
    expect(chromaOf(hexToLab(ink.bg[1]))).toBeLessThan(chromaOf(hexToLab(t.bg[1])));
    expect(chromaOf(hexToLab(ink.bg[1]))).toBeLessThan(0.012);
  });

  it("recipeOf gives back what the theme was made from", () => {
    const t = deriveTheme("perso-x", { name: "Nuit", a: "#a3b0de", b: "#7282bc", tint: 0.5 });
    const r = recipeOf(t);
    expect(r.name).toBe("Nuit");
    expect(r.tint).toBeCloseTo(0.5, 1);
    const again = deriveTheme("perso-x", r);
    for (let i = 0; i < 3; i++) expect(gap(again.bg[i]!, t.bg[i]!)).toBeLessThan(0.01);
    expect(gap(again.accent, t.accent)).toBeLessThan(0.01);
    // An imported theme without gradient: its accent and beam.
    const imported = { ...BUILTIN_THEMES[2]!, gradient: undefined };
    expect(recipeOf(imported).a).toBe(imported.accent);
  });
});
