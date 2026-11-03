import { clamp, eio, lerp, TAU } from "./motion";

/**
 * Kysland's « Dancing »: the figures the black drops swim to, each a formation over time (where
 * each drop goes, and its size). The heart: the mass turning and breathing, a slow swirl running
 * round it. Satellites: a few drops leave on orbits of their own, each at its speed, sometimes
 * turning back. Fusion: the mass splits in two halves that turn round each other, closer and
 * faster, until they melt into one. Mirror: it splits at once and the halves sway apart before
 * they meet again. Bloom: a crown that opens, stays open turning and breathing, then closes.
 * Fountain: from a pool, drops leap in arcs on every half beat, left then right, and rain back.
 * Snake: the mass unrolls into a chain that slides along a figure of eight, then curls up.
 * Lengths in beats; positions from the middle, in units of the mass's radius `R`. Pure but
 * for the randomness it is given.
 */

export type FigureKind =
  "heart" | "satellites" | "fusion" | "mirror" | "bloom" | "fountain" | "snake";

export const FIGURES: readonly FigureKind[] = [
  "satellites",
  "fusion",
  "mirror",
  "bloom",
  "fountain",
  "snake",
];

/** Each figure's length in beats. */
export const BEATS: Record<FigureKind, number> = {
  heart: 10,
  satellites: 18,
  fusion: 11,
  mirror: 16,
  bloom: 17,
  fountain: 16,
  snake: 20,
};

const GOLD = Math.PI * (3 - Math.sqrt(5));
const frac = (v: number) => v - Math.floor(v);

/** The `j`-th of `m` drops of a sunflower of radius `rad`, turned by `rot`. */
export function sun(j: number, m: number, rad: number, rot: number): [number, number] {
  const rr = rad * Math.sqrt((j + 0.5) / m);
  const a = j * GOLD + rot;
  return [Math.cos(a) * rr, Math.sin(a) * rr];
}

/** A satellite's orbit (radii of `R`, speed, way round, breathing). */
export interface Orbit {
  rx: number;
  ry: number;
  sp: number;
  dir: number;
  w2: number;
  ph: number;
  sz: number;
  ang: number;
}

export function orbit(random: () => number): Orbit {
  return {
    rx: 1.7 + 1.2 * random(),
    ry: 0.9 + 0.6 * random(),
    sp: 0.6 + 1.6 * random(),
    dir: random() < 0.5 ? -1 : 1,
    w2: 0.5 + random(),
    ph: random() * TAU,
    sz: 0.16 + 0.08 * random(),
    ang: random() * TAU,
  };
}

/** What a figure needs besides time: the bass, the beat, its own state. */
export interface FigureState {
  kind: FigureKind;
  /** The figure's time (s), the dance's (s, faster with the tempo and the energy), the beat's
   * length (s). */
  ft: number;
  td: number;
  P: number;
  /** The bass's envelope (0–1). */
  e0: number;
  /** How many drops. */
  n: number;
  orbits: Orbit[];
}

/** The heart: a sunflower turning, breathing with the bass, a swirl running round it. */
function heart(s: FigureState, i: number, rad: number): [number, number, number] {
  const [x, y] = sun(i, s.n, rad * (1 + 0.16 * s.e0), s.td * 0.9);
  const a = Math.atan2(y, x);
  const swirl = 1 + 0.1 * Math.sin(3 * a - 1.7 * s.td);
  return [x * swirl, y * 0.92 * swirl, 0.3 + 0.1 * Math.sin(s.td * 3.1 + i * 1.7)];
}

/** Where drop `i` goes now (x, y of `R` from the middle) and its radius (of `R`). */
export function place(s: FigureState, i: number): [number, number, number] {
  const { ft, td, P, n } = s;
  const len = BEATS[s.kind] * P;
  switch (s.kind) {
    case "heart":
      return heart(s, i, 0.62);
    case "satellites": {
      const out = ft > P && ft < len - 2.5 * P;
      if (i < 4 && out) {
        const o = s.orbits[i]!;
        const x = Math.cos(o.ang) * o.rx * (1 + 0.12 * Math.sin(td * o.w2 + o.ph));
        const y = Math.sin(o.ang) * o.ry * (1 + 0.12 * Math.cos(td * o.w2 * 1.3 + o.ph));
        return [x, y, o.sz];
      }
      const [x, y] = sun(i < 4 ? i : i - 4, i < 4 ? n : n - 4, 0.55, td * 0.5);
      return [x, y, i < 4 ? 0.24 : 0.28];
    }
    case "fusion": {
      const T = 7 * P;
      const p = clamp(ft / T, 0, 1);
      const a = ft * 1.6 + (4.5 * ft * ft) / T;
      const ro = 1.92 * (1 - p ** 1.4);
      const side = i % 2 ? 1 : -1;
      const [x, y] = sun(i >> 1, n / 2, 0.46, td * 0.6);
      return [side * Math.cos(a) * ro + x, side * Math.sin(a) * ro * 0.55 + y, p < 1 ? 0.27 : 0.3];
    }
    case "mirror": {
      const side = i % 2 ? 1 : -1;
      const split = eio(clamp((ft - 0.4 * P) / (1.2 * P), 0, 1));
      const back = 1 - eio(clamp((ft - len + 3 * P) / (2 * P), 0, 1));
      const k = split * back;
      const cx = side * 1.6 * k + 1.04 * Math.sin(td * 0.9 + side * 1.3) * k;
      const cy = 0.85 * Math.sin(td * 1.4 + side * 2.1) * k;
      const [x, y] = sun(i >> 1, n / 2, 0.48, td * 0.7 * side);
      return [cx + x, cy + y, 0.27];
    }
    case "bloom": {
      const o =
        ft < P
          ? 0
          : ft < 2.5 * P
            ? eio((ft - P) / (1.5 * P))
            : ft < 13 * P
              ? 1
              : ft < 16 * P
                ? 1 - eio((ft - 13 * P) / (3 * P))
                : 0;
      const a = (i * TAU) / n + td * (0.4 + 0.5 * o);
      const rr = 0.45 + 1.5 * o * (i % 2 ? 1 : 0.78) * (1 + 0.08 * Math.sin(td * 3 + i));
      const r = o > 0.05 ? 0.19 + 0.03 * Math.sin(td * 4 + i) : 0.26;
      return [Math.cos(a) * rr, Math.sin(a) * rr, r];
    }
    case "fountain": {
      // A pool a little low; eight jets, two on each half beat, alternating sides.
      const pool: [number, number] = [0, 0.4];
      const on = ft > 0.5 * P && ft < len - 1.5 * P;
      if (i < 8 && on) {
        const u = ((ft - (i % 4) * 0.5 * P) % (2 * P)) / (1.4 * P);
        if (u >= 0 && u < 1) {
          const side = (i % 2 ? 1 : -1) * (0.5 + 0.9 * frac(i * 0.618 + 0.1));
          const h = 1.1 + 0.9 * frac(i * 0.37 + 0.2);
          const x = pool[0] + side * eio(u);
          const y = pool[1] - h * 4 * u * (1 - u);
          return [x, y, 0.17 + 0.06 * Math.sin(Math.PI * u)];
        }
      }
      const [x, y] = sun(i, n, 0.58, td * 0.6);
      return [pool[0] + x * 1.15, pool[1] + y * 0.62, 0.27];
    }
    case "snake": {
      // One loop of the eight in eight beats; each link a little behind the one before.
      const w = TAU / (8 * P);
      const s0 = ft * w - i * 0.16;
      const into = eio(clamp(s0 / 0.7, 0, 1));
      const out = 1 - eio(clamp((ft - (len - 2.5 * P)) / (2 * P), 0, 1));
      const k = into * out;
      const [hx, hy, hr] = heart(s, i, 0.62);
      const r = 0.31 - 0.16 * (i / Math.max(1, n - 1));
      return [
        lerp(hx, 2.2 * Math.sin(s0), k),
        lerp(hy, 0.85 * Math.sin(2 * s0), k),
        lerp(hr, r, k),
      ];
    }
  }
}

/** How the drops follow their places in a figure: stiffer (×) and damping. */
export function feel(kind: FigureKind): { k: number; z: number | null } {
  if (kind === "mirror") return { k: 1.6, z: 0.3 };
  if (kind === "fusion") return { k: 2, z: 0.42 };
  if (kind === "fountain") return { k: 6, z: 0.5 };
  if (kind === "snake") return { k: 3, z: 0.55 };
  return { k: 1, z: null };
}

/** The next figure after the heart: any but the last two. */
export function nextFigure(last: readonly FigureKind[], random: () => number): FigureKind {
  const fresh = FIGURES.filter((f) => !last.slice(-2).includes(f));
  return fresh[Math.floor(random() * fresh.length)] ?? "satellites";
}
