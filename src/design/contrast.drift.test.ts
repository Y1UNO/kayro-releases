import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODEL } from "./contrast";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf-8");

/** Value of `--name:` inside the :root block, whitespace-normalised. */
function token(name: string): string {
  const m = new RegExp(`\\n\\s*${name}:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`token ${name} not found in tokens.css`);
  return (m[1] as string).replace(/\s+/g, "").replace(/\/\*.*$/, "");
}

const norm = (v: string) =>
  v
    .replace(/\s+/g, "")
    .replace(/0\./g, ".")
    .replace(/\.0+(?=\D|$)/g, "");

/** Guards against editing tokens.css without updating the contrast model (or the reverse). */
describe("contrast model matches tokens.css", () => {
  it.each([
    ["--text", MODEL.text],
    ["--text-2", MODEL.text2],
    ["--text-3", MODEL.text3],
    ["--text-active", MODEL.textActive],
    ["--text-on-accent", MODEL.textOnAccent],
    ["--glass-tint", MODEL.glassTint],
    ["--glass-bg-eco", MODEL.glassEco],
  ])("%s", (name, expected) => {
    expect(norm(token(name))).toBe(norm(expected));
  });

  it.each([
    ["--fill-soft", MODEL.fillSoft],
    ["--fill-tab-active", MODEL.fillTabActive],
    ["--fill-active", MODEL.fillActive],
    ["--field", MODEL.field],
    ["--nav-active", MODEL.navActive],
  ])("%s alpha", (name, alpha) => {
    const m = /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)/.exec(token(name).replace(/,/g, ", "));
    expect(Number(m?.[1])).toBeCloseTo(alpha, 5);
  });

  it("glass filter brightness", () => {
    expect(css).toContain(`brightness(${MODEL.glassBrightness})`);
  });
});
