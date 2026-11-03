import { sv, type Sv } from "./motion";

/**
 * Kysland's « Disk »: the title's pieces. Its font (Fredoka, round and soft), how a title is cut
 * into lines that fit, a letter's state, and its stamp: the letter drawn once into a canvas of
 * its own (black, a soft gloss from above and an inner rim of the island's tone: jelly), then
 * stamped every frame. Logical px.
 */

export const TITLE_FONT = '"Fredoka Variable", "Fredoka", "Segoe UI", sans-serif';
export const fontAt = (size: number): string => `700 ${Math.round(size)}px ${TITLE_FONT}`;

export interface TitleLook {
  tone: string;
  effects: boolean;
  calm: boolean;
  dpr: number;
}

export type State = "wait" | "fly" | "rest" | "hold" | "suck" | "fade" | "gone";

export interface Letter {
  ch: string;
  i: number;
  tx: number;
  ty: number;
  /** Where its spring holds it (it flies there), and what the hold adds on top. */
  x: number;
  y: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  k: number;
  st: State;
  /** When its next move starts (s, the title's clock). */
  go: number;
  jx: Sv;
  jy: Sv;
  sx: number;
  s: number;
  ang: number;
  hold: number;
  q: number;
  pr0: number;
  pt0: number;
  alpha: number;
}

/** A letter drawn once: its canvas and its size on the stage. */
export interface Stamp {
  c: HTMLCanvasElement;
  w: number;
  h: number;
}

/** Supersampling of the stamps (they stretch as jelly). */
const SS = 1.3;
/** Lines' spacing (of the size). */
export const LEAD = 1.08;

/** `s` shortened with « … » until `fits` (one character at least). */
function shorten(s: string, fits: (s: string) => boolean): string {
  let out = s;
  while (!fits(out) && Array.from(out).length > 2)
    out = `${Array.from(out).slice(0, -2).join("").trimEnd()}…`;
  return out;
}

/**
 * The lines of a title at the largest size that fits `maxW` (one line, else two), no smaller
 * than `min` (the last line then shortened with « … »). Pure, tested.
 */
export function fitTitle(
  text: string,
  measure: (s: string, size: number) => number,
  max: number,
  min: number,
  maxW: number,
): { lines: string[]; size: number } {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return { lines: [], size: max };
  const fit = (s: string) => Math.min(max, (max * maxW) / Math.max(1, measure(s, max)));
  const ok = (s: string) => fit(s) >= min;
  const one = fit(clean);
  if (one >= min) return { lines: [clean], size: one };
  if (!clean.includes(" ")) {
    const s = shorten(clean, ok);
    return { lines: [s], size: Math.max(min, fit(s)) };
  }
  // Two lines, cut at the space nearest the middle.
  const mid = clean.length / 2;
  let cut = -1;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === " " && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
  }
  const a = shorten(clean.slice(0, cut), ok);
  const b = shorten(clean.slice(cut + 1), ok);
  return { lines: [a, b], size: Math.max(min, Math.min(fit(a), fit(b))) };
}

export function letter(ch: string, i: number, tx: number, ty: number): Letter {
  return {
    ch,
    i,
    tx,
    ty,
    x: tx,
    y: ty,
    ox: 0,
    oy: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    vr: 0,
    k: 0,
    st: "wait",
    go: Infinity,
    jx: sv(1),
    jy: sv(1),
    sx: 1,
    s: 1,
    ang: 0,
    hold: 0,
    q: 0,
    pr0: 0,
    pt0: 0,
    alpha: 1,
  };
}

/** Letter `ch` at size `f`, drawn once: black jelly (effects on: gloss and inner rim). */
export function stamp(
  ch: string,
  f: number,
  look: TitleLook,
  make: (w: number, h: number) => HTMLCanvasElement,
): Stamp | null {
  const k = look.dpr * SS;
  const w = Math.ceil(f * 1.15);
  const h = Math.ceil(f * 1.3);
  const [cw, chh] = [Math.ceil(w * k), Math.ceil(h * k)];
  const c = make(cw, chh);
  const g = c.getContext("2d");
  if (!g) return null;
  const write = (ctx: CanvasRenderingContext2D, style: string, dy = 0) => {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.font = fontAt(f);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = style;
    ctx.fillText(ch, w / 2, h / 2 + dy);
  };
  write(g, "#000");
  if (!look.effects) return { c, w, h };
  // Jelly, never outlined (the font's outlines overlap inside its letters: a stroke shows them):
  // the top edges of the ink catch the light (a thin crescent of the island's tone: the letter
  // minus itself moved down), and a faint sheen on its upper half. The black stays black.
  const lit = make(cw, chh);
  const l = lit.getContext("2d");
  if (l) {
    write(l, `rgb(${look.tone})`);
    l.globalCompositeOperation = "destination-out";
    write(l, "#000", Math.max(1, f * 0.022));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = 0.26;
    g.drawImage(lit, 0, 0);
    g.globalAlpha = 1;
  }
  lit.width = 0;
  lit.height = 0;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.globalCompositeOperation = "source-atop";
  const sheen = g.createLinearGradient(0, h * 0.2, 0, h * 0.55);
  sheen.addColorStop(0, "rgb(255 255 255 / 0.07)");
  sheen.addColorStop(1, "rgb(255 255 255 / 0)");
  g.fillStyle = sheen;
  g.fillRect(0, 0, w, h);
  return { c, w, h };
}
