// Step-14 board: how a game's palette becomes Kayro's colours. Prototype of the future
// src/features/gameColors/derive.ts (same rules, same names), kept plain JS so the board opens
// from the disk. OKLab maths: Björn Ottosson (2020), the same as src-tauri/src/art/palette.rs.
(() => {
"use strict";

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToLab(hex) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function labToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);

/** OKLab → #rrggbb; out of the sRGB gamut, the chroma shrinks (hue and lightness kept). */
function labToHex(lab) {
  let [L, a, b] = lab;
  for (let i = 0; i < 24 && !inGamut(labToRgb([L, a, b])); i++) {
    a *= 0.92;
    b *= 0.92;
  }
  return (
    "#" +
    labToRgb([L, a, b])
      .map((c) => Math.round(gam(Math.min(1, Math.max(0, c))) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

const chroma = (c) => Math.hypot(c[1], c[2]);
const hue = (c) => Math.atan2(c[2], c[1]);
const mix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
const lab = (c) => [c.l, c.a, c.b];

/** L and C bounds of V6. */
const BOUNDS = {
  a: { lMin: 0.72, lMax: 0.85, cMax: 0.12 },
  b: { lMin: 0.68, lMax: 0.85, cMax: 0.18 },
  c: { lMin: 0.62, lMax: 0.95, cMax: 0.37 },
};

function normalise(c, v6) {
  const k = BOUNDS[v6];
  const L = Math.min(k.lMax, Math.max(k.lMin, c[0]));
  const C = Math.min(k.cMax, chroma(c));
  const h = hue(c);
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

function vivid(p) {
  return p.colors
    .map((c, i) => ({ i, score: Math.sqrt(c.weight) * chroma(lab(c)) }))
    .sort((x, y) => y.score - x.score);
}

const hueGap = (p, q) => {
  const d = Math.abs(hue(p) - hue(q)) % (2 * Math.PI);
  return (Math.min(d, 2 * Math.PI - d) * 180) / Math.PI;
};

/**
 * A and B of a game (V5), raw. The user's rule (14/10): an image of one colour (accent = dominant)
 * takes its accent from the game's other image (poster or hero), else from the theme.
 */
function gamePair(main, other, themeB, v5) {
  const dom = lab(main.colors[main.dominant]);
  let acc = main.accent !== main.dominant ? lab(main.colors[main.accent]) : null;
  if (!acc && other && other.accent !== other.dominant) acc = lab(other.colors[other.accent]);
  if (!acc) acc = themeB;
  if (v5 === "b") {
    const v = vivid(main);
    const first = lab(main.colors[v[0].i]);
    const second = v.slice(1).find((x) => hueGap(lab(main.colors[x.i]), first) >= 25);
    return [first, second ? lab(main.colors[second.i]) : acc];
  }
  if (v5 === "c") return [dom, themeB];
  return [dom, acc];
}

/** A dark night of the game's hue (immersive background), from top to bottom. */
function night(src, themeBg, t) {
  const C = Math.min(0.045, chroma(src));
  const h = hue(src);
  return [0.22, 0.155, 0.09].map((L, i) =>
    labToHex(mix(hexToLab(themeBg[i]), [L, C * Math.cos(h), C * Math.sin(h)], t)),
  );
}

/**
 * Colours of the board for a theme, an optional palette and the choices. Returns hex strings:
 * `ambA/ambB` (engine: halo, ring, bokeh), `uiA/uiB` (accents), `soft`, `bar`, `bg` [3].
 */
function derive(theme, source, choice) {
  const tA = hexToLab(theme.gradient[0]);
  const tB = hexToLab(theme.gradient[1]);
  const base = {
    ambA: theme.gradient[0],
    ambB: theme.gradient[1],
    uiA: theme.gradient[0],
    uiB: theme.gradient[1],
    soft: theme.soft,
    bar: null,
    bg: theme.bg,
  };
  if (!source || choice.mode === "off") return base;
  const t = { a: 0.35, b: 0.6, c: 1 }[choice.v1];
  const [rawA, rawB] = gamePair(source.main, source.other, tB, choice.v5);
  const gA = labToHex(mix(tA, normalise(rawA, choice.v6), t));
  const gB = labToHex(mix(tB, normalise(rawB, choice.v6), t));
  const out = { ...base, ambA: gA, ambB: gB };
  if (choice.v2 !== "a") Object.assign(out, { uiA: gA, uiB: gB });
  if (choice.v2 === "c") {
    const a = hexToLab(gA);
    out.soft = labToHex([0.88, a[1] * 0.45, a[2] * 0.45]);
    out.bar = gA;
  }
  if (choice.mode === "immersive") {
    const dark = lab(source.main.colors[source.main.dominant]);
    out.bg = night(chroma(dark) > 0.02 ? dark : rawA, theme.bg, t);
  }
  return out;
}

window.Derive = { derive, hexToLab, labToHex };
})();
