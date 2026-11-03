import { clamp, lerp, TAU, type Sv } from "./motion";

/**
 * Kysland's « Disk »: how its parts are drawn. The disc's jelly outline (a few round modes on
 * its radius, and slow ripples always running round it), the strings in the album's colours
 * (each shows only while its instrument pulses, glowing), the sheen and lit edge of the jelly
 * (flashing on a crash), and the rings of colour that escape on the big hits (wobbly, broken,
 * thick at first, thinning as they fade). Logical px.
 */

/** Its strings: the band each follows (bass first), its radius (of the disc's). */
export const STRINGS = [
  { band: 0, k: 0.6 },
  { band: 1, k: 0.7 },
  { band: 3, k: 0.8 },
  { band: 4, k: 0.9 },
] as const;
/** Points on a string. */
export const N = 150;
/** An escaping ring lasts this long (s). */
export const ESCAPE = 1.7;

/** A round mode of the jelly: how many waves round, its height (px) and where. */
export interface Mode {
  m: number;
  a: Sv;
  ph: number;
}

export interface Ring {
  u: Float32Array;
  v: Float32Array;
}

export interface Escape {
  col: string;
  t: number;
  p: [number, number, number];
  rot: number;
  /** A crash's: wider, thicker, further. */
  big: boolean;
}

/**
 * The disc's outline: its radius `Rs`, its modes, and ripples always running round it (`flow`
 * px high, at time `t`): the jelly never quite still.
 */
export function discPath(
  x: number,
  y: number,
  Rs: number,
  modes: readonly Mode[],
  t = 0,
  flow = 0,
): Path2D {
  const p = new Path2D();
  for (let i = 0; i <= 120; i++) {
    const th = (i / 120) * TAU;
    let r = Rs + flow * (Math.sin(4 * th - 1.3 * t) + 0.7 * Math.sin(7 * th + 0.9 * t + 1.1));
    for (const md of modes) r += md.a.x * Math.cos(md.m * (th - md.ph));
    if (i === 0) p.moveTo(x + Math.cos(th) * r, y + Math.sin(th) * r);
    else p.lineTo(x + Math.cos(th) * r, y + Math.sin(th) * r);
  }
  p.closePath();
  return p;
}

/** The strings whose band pulses (`lift`: above its recent level), glowing (effects on). */
export function drawStrings(
  ctx: CanvasRenderingContext2D,
  rings: readonly Ring[],
  lift: readonly number[],
  cols: readonly string[],
  x: number,
  y: number,
  Rs: number,
  core: number,
  glow: boolean,
  fade: number,
): void {
  STRINGS.forEach((s, i) => {
    const a = 0.95 * (lift[s.band] ?? 0) ** 1.15 * fade;
    if (a < 0.02) return;
    const u = rings[i]!.u;
    const col = cols[i] ?? "255 255 255";
    ctx.beginPath();
    for (let j = 0; j <= N; j++) {
      const th = ((j % N) / N) * TAU;
      const rr = Rs * s.k + u[j % N]!;
      if (j === 0) ctx.moveTo(x + Math.cos(th) * rr, y + Math.sin(th) * rr);
      else ctx.lineTo(x + Math.cos(th) * rr, y + Math.sin(th) * rr);
    }
    ctx.closePath();
    if (glow) {
      // A wide soft bloom, a glow, then the string itself.
      ctx.lineWidth = core * 9;
      ctx.strokeStyle = `rgb(${col} / ${(a * 0.07).toFixed(3)})`;
      ctx.stroke();
      ctx.lineWidth = core * 3.5;
      ctx.strokeStyle = `rgb(${col} / ${(a * 0.26).toFixed(3)})`;
      ctx.stroke();
    }
    ctx.lineWidth = s.band === 0 ? core * 1.5 : core;
    ctx.strokeStyle = `rgb(${col} / ${a.toFixed(3)})`;
    ctx.stroke();
  });
}

/** How far the bass's halo reaches (of the disc's radius), at its strongest. */
export const HALO = 1.55;

/** The bass breathing out of the disc: a soft halo of its colour around it (`k`: 0–1). */
export function drawHalo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  Rs: number,
  col: string,
  k: number,
): void {
  if (k < 0.02) return;
  const out = Rs * (1.22 + 0.33 * k);
  const g = ctx.createRadialGradient(x, y, Rs * 0.92, x, y, out);
  g.addColorStop(0, `rgb(${col} / ${(0.42 * k).toFixed(3)})`);
  g.addColorStop(0.45, `rgb(${col} / ${(0.14 * k).toFixed(3)})`);
  g.addColorStop(1, `rgb(${col} / 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - out, y - out, 2 * out, 2 * out);
}

/** Jelly: a soft sheen on the black ring, from the top left (drawn inside the disc's clip). */
export function drawGloss(ctx: CanvasRenderingContext2D, x: number, y: number, Rs: number): void {
  const g = ctx.createRadialGradient(x - 0.36 * Rs, y - 0.42 * Rs, 0, x, y, 1.05 * Rs);
  g.addColorStop(0, "rgb(255 255 255 / 0.1)");
  g.addColorStop(0.5, "rgb(255 255 255 / 0.025)");
  g.addColorStop(1, "rgb(255 255 255 / 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 1.2 * Rs, y - 1.2 * Rs, 2.4 * Rs, 2.4 * Rs);
}

/**
 * Its edge lit from the top left, inside only, in the island's tone (no line drawn on it); a
 * crash flashes it (`flash` 0–1): the edge all round, and a light through the jelly.
 */
export function drawShine(
  ctx: CanvasRenderingContext2D,
  body: Path2D,
  x: number,
  y: number,
  Rs: number,
  tone: string,
  flash: number,
): void {
  ctx.save();
  ctx.clip(body);
  const rim = ctx.createLinearGradient(x - Rs, y - Rs, x + Rs, y + Rs);
  rim.addColorStop(0, `rgb(${tone} / ${(0.22 + 0.5 * flash).toFixed(3)})`);
  rim.addColorStop(0.6, `rgb(${tone} / ${(0.4 * flash).toFixed(3)})`);
  rim.addColorStop(1, `rgb(${tone} / ${(0.25 * flash).toFixed(3)})`);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 3 + 5 * flash;
  ctx.stroke(body);
  if (flash > 0.02) {
    const g = ctx.createRadialGradient(x, y, 0.45 * Rs, x, y, Rs);
    g.addColorStop(0, "rgb(255 255 255 / 0)");
    g.addColorStop(1, `rgb(255 255 255 / ${(0.16 * flash).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(x - Rs * 1.2, y - Rs * 1.2, 2.4 * Rs, 2.4 * Rs);
  }
  ctx.restore();
}

/** Where the colour comes and goes around an escaping ring. */
const BROKEN = [
  [0, 0.95],
  [0.18, 0.05],
  [0.32, 0.75],
  [0.55, 0.95],
  [0.72, 0],
  [0.86, 0.6],
  [1, 0.95],
] as const;

/** How far a ring escapes (of the disc's radius), and a crash's. */
export const REACH = 1.8;
export const REACH_BIG = 2.1;

/** A ring of colour escaping the disc of radius `Rs` (`R`: its size at rest, for the widths). */
export function drawEscape(
  ctx: CanvasRenderingContext2D,
  e: Escape,
  x: number,
  y: number,
  Rs: number,
  R: number,
): void {
  const u = clamp(e.t / ESCAPE, 0, 1);
  const rr = Rs * lerp(0.95, e.big ? REACH_BIG : REACH, 1 - (1 - u) ** (e.big ? 3.4 : 2.6));
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const th = (i / 120) * TAU;
    const w =
      1 +
      0.07 * Math.sin(3 * th + e.p[0] + u * 5) +
      0.045 * Math.sin(5 * th + e.p[1] - u * 7) +
      0.03 * Math.sin(9 * th + e.p[2] + u * 3);
    if (i === 0) ctx.moveTo(x + Math.cos(th) * rr * w, y + Math.sin(th) * rr * w);
    else ctx.lineTo(x + Math.cos(th) * rr * w, y + Math.sin(th) * rr * w);
  }
  ctx.closePath();
  const a = (1 - u) * (1 - u);
  const g = ctx.createConicGradient(e.rot + u * 2.5, x, y);
  for (const [at, k] of BROKEN) g.addColorStop(at, `rgb(${e.col} / ${(a * k).toFixed(3)})`);
  const s = Math.sqrt(R / 54) * (e.big ? 1.6 : 1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = g;
  ctx.lineWidth = lerp(10, 3, u) * s;
  const base = ctx.globalAlpha;
  ctx.globalAlpha = base * 0.24;
  ctx.stroke();
  ctx.globalAlpha = base;
  ctx.lineWidth = lerp(4, 0.8, u) * s;
  ctx.stroke();
}
