import { CAPRI } from "../../capri/capri";

/**
 * Kysland's « Disk »: its strings in the album's colours. The cover gives two (its dominant and
 * its accent, « r g b »); from them, four bright enough to glow on black jelly: the bass in the
 * accent, the low mids in the dominant (turned aside if both are alike), the snare in the accent
 * turned round a little, the hi-hats in a pale tint. A grey cover gives shades of white; no
 * cover, Capri's colours. Pure, tested.
 */

const capri = (hex: number) => `${(hex >> 16) & 255} ${(hex >> 8) & 255} ${hex & 255}`;

export const CAPRI_STRINGS = [
  capri(CAPRI.red),
  capri(CAPRI.violet),
  capri(CAPRI.green),
  "236 242 255",
] as const;

/** « r g b » → hue (degrees), saturation and lightness (0–1). */
export function toHsl(rgb: string): [number, number, number] {
  const [r, g, b] = rgb.split(/\s+/).map((v) => Number(v) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [(h + 360) % 360, s, l];
}

/** Hue (degrees), saturation and lightness (0–1) → « r g b ». */
export function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] =
    hh < 1
      ? [c, x, 0]
      : hh < 2
        ? [x, c, 0]
        : hh < 3
          ? [0, c, x]
          : hh < 4
            ? [0, x, c]
            : hh < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = l - c / 2;
  return [r, g, b].map((v) => Math.round((v + m) * 255)).join(" ");
}

/** The colour made to glow on black: lightness kept within `lo`–`hi`, saturation at least `s`. */
export function vivid(rgb: string, lo = 0.56, hi = 0.78, s = 0.55, turn = 0): string {
  const [h, sat, l] = toHsl(rgb);
  return fromHsl(h + turn, Math.max(s, sat), Math.min(hi, Math.max(lo, l)));
}

const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** The four strings' colours (bass, low mids, snare, hi-hats) from the album's two. */
export function stringColours(accent: string | null, dominant: string | null): string[] {
  const a = accent ?? dominant;
  const d = dominant ?? accent;
  if (!a || !d) return [...CAPRI_STRINGS];
  const [ha, sa] = toHsl(a);
  const [hd, sd] = toHsl(d);
  if (Math.max(sa, sd) < 0.12) return ["236 236 236", "205 205 205", "224 224 224", "250 250 250"];
  // The more colourful of the two leads.
  const [lead, other, hl, ho] = sa >= sd ? [a, d, ha, hd] : [d, a, hd, ha];
  const low = apart(hl, ho) < 25 ? vivid(other, 0.56, 0.74, 0.55, -45) : vivid(other);
  return [vivid(lead), low, vivid(lead, 0.62, 0.8, 0.6, 40), fromHsl(hl, 0.45, 0.9)];
}
