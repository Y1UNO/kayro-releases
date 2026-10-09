// Pure colour helpers (no DOM): parsing, alpha compositing, WCAG contrast.

export interface Rgba {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-1
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const FUNC = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

export function parseColor(input: string): Rgba | null {
  const s = input.trim();
  const hex = HEX.exec(s);
  if (hex) {
    const h = hex[1] ?? "";
    const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }
  const fn = FUNC.exec(s);
  if (fn) {
    const [r, g, b] = [fn[1], fn[2], fn[3]].map((v) => Number(v));
    const a = fn[4] === undefined ? 1 : Number(fn[4]);
    if ([r, g, b].every((v) => v !== undefined && v >= 0 && v <= 255) && a >= 0 && a <= 1) {
      return { r: r as number, g: g as number, b: b as number, a };
    }
  }
  return null;
}

export function mustParse(input: string): Rgba {
  const c = parseColor(input);
  if (!c) throw new Error(`Invalid colour: ${input}`);
  return c;
}

/** `top` painted over `bottom` (standard "source-over"). */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
}

/** Stack of layers, first = bottom. */
export function flatten(layers: Rgba[]): Rgba {
  const [first, ...rest] = layers;
  if (!first) throw new Error("flatten: no layers");
  return rest.reduce((acc, layer) => over(layer, acc), first);
}

export function scale(c: Rgba, k: number): Rgba {
  const f = (v: number) => Math.min(255, v * k);
  return { r: f(c.r), g: f(c.g), b: f(c.b), a: c.a };
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(c: Rgba): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG 2.x contrast ratio. `fg` is flattened over `bg` first when translucent; `bg` must be opaque. */
export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const solid = fg.a < 1 ? over(fg, bg) : fg;
  const [hi, lo] = [luminance(solid), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
