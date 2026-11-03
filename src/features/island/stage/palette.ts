import { clamp } from "./motion";

/**
 * Kysland's music mode (the lab's `palette()`): two vivid colours from the cover, for all the
 * light (halo, rays, strings, waves) and the rim of the ink. The cover is shrunk to 24 × 24, each
 * coloured pixel votes for its hue (by its saturation, more for middle lightness), the most voted
 * hue is the first colour, the next one at least 45° away the second (else the first turned
 * 40°). A grey cover: a red and its neighbour. Colours as 0–1 triples.
 */

export type Rgb = [number, number, number];

export interface Palette {
  c1: Rgb;
  c2: Rgb;
}

export const DEFAULT_PALETTE: Palette = { c1: [1, 0.25, 0.42], c2: [0.8, 0.2, 0.9] };

export function hsl2rgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** The two colours from RGBA pixels (any size). Pure, tested. */
export function paletteOf(d: Uint8ClampedArray | number[]): Palette {
  const bins = new Float32Array(24);
  for (let i = 0; i + 3 < d.length; i += 4) {
    const [r, g, b] = [d[i]! / 255, d[i + 1]! / 255, d[i + 2]! / 255];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    const ch = mx - mn;
    if (ch < 0.08) continue;
    const s = ch / (1 - Math.abs(2 * l - 1) + 1e-6);
    let h = mx === r ? ((g - b) / ch) % 6 : mx === g ? (b - r) / ch + 2 : (r - g) / ch + 4;
    h = (h * 60 + 360) % 360;
    bins[Math.floor(h / 15) % 24]! += s * s * Math.max(0, 1 - Math.abs(l - 0.5) * 1.5);
  }
  const sm = (i: number) => bins[(i + 23) % 24]! * 0.5 + bins[i]! + bins[(i + 1) % 24]! * 0.5;
  let b1 = 0;
  for (let i = 1; i < 24; i++) if (sm(i) > sm(b1)) b1 = i;
  let b2 = -1;
  for (let i = 0; i < 24; i++) {
    const dd = Math.min(Math.abs(i - b1), 24 - Math.abs(i - b1));
    if (dd >= 3 && (b2 < 0 || sm(i) > sm(b2))) b2 = i;
  }
  const tot = bins.reduce((a, b) => a + b, 0);
  const h1 = tot < 0.5 ? 345 : b1 * 15 + 7.5;
  const h2 = tot < 0.5 || b2 < 0 || sm(b2) < sm(b1) * 0.08 ? (h1 + 40) % 360 : b2 * 15 + 7.5;
  return { c1: hsl2rgb(h1, 0.95, 0.6), c2: hsl2rgb(h2, 0.9, 0.58) };
}

/** The two colours of a cover image (drawn small first). */
export function paletteOfImage(img: CanvasImageSource): Palette {
  const c = document.createElement("canvas");
  c.width = c.height = 24;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return DEFAULT_PALETTE;
  try {
    g.drawImage(img, 0, 0, 24, 24);
    return paletteOf(g.getImageData(0, 0, 24, 24).data);
  } catch {
    // A cover the canvas may not read (tainted): the default colours.
    return DEFAULT_PALETTE;
  } finally {
    c.width = c.height = 0;
  }
}

/** A « r g b » colour's hue (degrees), or null if it is grey. */
function hueOf(rgb: string): number | null {
  const [r, g, b] = rgb.split(/\s+/).map((v) => clamp(Number(v) || 0, 0, 255) / 255) as Rgb;
  const mx = Math.max(r, g, b);
  const ch = mx - Math.min(r, g, b);
  if (ch < 0.08) return null;
  const h = mx === r ? ((g - b) / ch) % 6 : mx === g ? (b - r) / ch + 2 : (r - g) / ch + 4;
  return (h * 60 + 360) % 360;
}

/** Two colours from « r g b » strings (Kayro's theme accent, then another): as vivid as a cover's. */
export function paletteOfRgb(a: string, b: string): Palette {
  const h1 = hueOf(a) ?? 345;
  const hb = hueOf(b);
  const apart = hb === null ? 0 : Math.min(Math.abs(hb - h1), 360 - Math.abs(hb - h1));
  const h2 = hb === null || apart < 45 ? (h1 + 40) % 360 : hb;
  return { c1: hsl2rgb(h1, 0.95, 0.6), c2: hsl2rgb(h2, 0.9, 0.58) };
}

/** A 0–1 colour as CSS rgba. */
export const css = (c: Rgb, a: number): string =>
  `rgba(${c.map((v) => Math.round(clamp(v, 0, 1) * 255)).join(",")},${a})`;
