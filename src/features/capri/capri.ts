/**
 * Step 20: « Capri », the glitch look of Kayro (after the user's references: a jagged,
 * glittering digital creature). Jagged spikes shooting out of an edge — hot red with a glitter of
 * white specks, neon green, black outlined in violet — drawn in held frames (about 14 a second,
 * not smoothly), the way limited animation glitches. Pure shapes here, and a canvas painter: the
 * island sends them to the core's effects layer, the installer and the patch notes page draw them
 * themselves.
 */

export const CAPRI = {
  red: 0xff1f4d,
  green: 0x3dff7a,
  black: 0x07070a,
  violet: 0x8b3dff,
} as const;

/** A held frame lasts this long (s). */
export const CAPRI_STEP = 0.07;

export type Rand = () => number;

export interface Point {
  x: number;
  y: number;
}

/** One spike: a polygon (x, y pairs), its fill and outline (0xRRGGBB), white specks. */
export interface CapriShape {
  pts: number[];
  fill: number;
  stroke: number | null;
  dots: number[];
}

/** An edge: vertical at x = `at` or horizontal at y = `at`, glitching from `from` to `to`
 * along it, its spikes on one side (`sides` ±1) or both (0). */
export interface Edge {
  vertical: boolean;
  at: number;
  from: number;
  to: number;
  sides: -1 | 0 | 1;
}

/** `#rrggbb` of a colour. */
export const css = (rgb: number): string => `#${rgb.toString(16).padStart(6, "0")}`;

/** A held frame of spikes along `edge`, as many and as long as `level` (0–1) says. */
export function spikes(
  edge: Edge,
  level: number,
  r: Rand = Math.random,
  reach = 130,
): CapriShape[] {
  const out: CapriShape[] = [];
  const count = Math.round(5 + 15 * level);
  for (let i = 0; i < count; i++) {
    const along = edge.from + (edge.to - edge.from) * r();
    const base = edge.vertical ? { x: edge.at, y: along } : { x: along, y: edge.at };
    const side = edge.sides !== 0 ? edge.sides : r() < 0.5 ? -1 : 1;
    const angle = (r() - 0.5) * 1.6;
    const nx = edge.vertical ? side : 0;
    const ny = edge.vertical ? 0 : side;
    const dir = {
      x: nx * Math.cos(angle) - ny * Math.sin(angle),
      y: nx * Math.sin(angle) + ny * Math.cos(angle),
    };
    const long = r() < 0.15 ? 1.8 : 1;
    out.push(spike(r, base, dir, (18 + r() * reach) * (0.35 + 0.65 * level) * long));
  }
  return out;
}

/** Paints shapes (their coordinates less `origin`) on a canvas, at opacity `alpha`. */
export function paintShapes(
  ctx: CanvasRenderingContext2D,
  shapes: readonly CapriShape[],
  origin: Point = { x: 0, y: 0 },
  alpha = 1,
): void {
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  for (const sh of shapes) {
    ctx.beginPath();
    for (let i = 0; i < sh.pts.length; i += 2) {
      const x = (sh.pts[i] ?? 0) - origin.x;
      const y = (sh.pts[i + 1] ?? 0) - origin.y;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = css(sh.fill);
    ctx.fill();
    if (sh.stroke !== null) {
      ctx.strokeStyle = css(sh.stroke);
      ctx.lineWidth = 1.2;
      ctx.lineJoin = "miter";
      ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    for (let i = 0; i < sh.dots.length; i += 2) {
      ctx.fillRect((sh.dots[i] ?? 0) - origin.x, (sh.dots[i + 1] ?? 0) - origin.y, 1.2, 1.2);
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * A burst of Capri on a canvas: held frames along `edges` for `ms`, strong then fading, then the
 * canvas is cleared. Returns a function that stops it at once. Nothing runs after it.
 */
export function burst(
  canvas: HTMLCanvasElement,
  edges: readonly Edge[],
  ms = 700,
  r: Rand = Math.random,
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const start = performance.now();
  let timer = 0;
  const frame = () => {
    const t = (performance.now() - start) / ms;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (t >= 1) return;
    const dpr = canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const level = t < 0.15 ? 1 : 1 - (t - 0.15) / 0.85;
    for (const e of edges) paintShapes(ctx, spikes(e, level, r, 90), { x: 0, y: 0 }, level * 1.3);
    timer = window.setTimeout(frame, CAPRI_STEP * 1000);
  };
  frame();
  return () => {
    window.clearTimeout(timer);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}

/** One jagged spike from `base` along `dir`, `len` long: a lightning-like shard. */
export function spike(r: Rand, base: Point, dir: Point, len: number): CapriShape {
  const width = 4 + r() * 12;
  const perp = { x: -dir.y, y: dir.x };
  const at = (t: number, off: number): [number, number] => [
    base.x + dir.x * len * t + perp.x * off,
    base.y + dir.y * len * t + perp.y * off,
  ];
  const pts = [
    ...at(0, width),
    ...at(0.38, width * (0.9 + r())),
    ...at(0.46, width * 0.2),
    ...at(1, 0),
    ...at(0.7, -width * (0.5 + r() * 0.6)),
    ...at(0, -width),
  ];
  const kind = r();
  const red = kind < 0.5;
  const fill = red ? CAPRI.red : kind < 0.72 ? CAPRI.green : CAPRI.black;
  const stroke = fill === CAPRI.green ? null : CAPRI.violet;
  const dots: number[] = [];
  if (red) {
    const [p0, p1, p2] = [at(0, width * 0.8), at(0.9, 0), at(0, -width * 0.8)];
    for (let i = 0, n = 3 + Math.floor(r() * 5); i < n; i++) {
      // A point of the triangle base-left, tip, base-right: glitter inside the red.
      let a = r();
      let b = r();
      if (a + b > 1) {
        a = 1 - a;
        b = 1 - b;
      }
      dots.push(
        p0[0] + a * (p1[0] - p0[0]) + b * (p2[0] - p0[0]),
        p0[1] + a * (p1[1] - p0[1]) + b * (p2[1] - p0[1]),
      );
    }
  }
  return { pts, fill, stroke, dots };
}
