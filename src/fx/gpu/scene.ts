import type { Quality } from "../../design";
import { budgetFor } from "../budget";
import { hash } from "../hash";
import {
  advance,
  emberAlpha,
  MAX_PARTICLES,
  seedEmbers,
  seedStars,
  STRIDE,
  twinkle,
} from "../canvas/particles";
import type { FxPalette, FxParams } from "../FxLayer";
import { MAX_MOOD_SPRITES, MoodSim } from "../mood/moodSim";

/**
 * Particles of the glass engine's background: the embers and stars of round 1 (same seeds and
 * timing as the Canvas 2D layer, src/fx/canvas/particles.ts) plus bokeh, written each frame into
 * one instance buffer (no allocation). They are drawn into the background texture, so every
 * piece of glass refracts them.
 */
export const MAX_BOKEH = 24;
/** Eco draws at most this many bokeh discs (round 5). */
const ECO_BOKEH = 4;
/** The bokeh's colour is lightened this far towards white (round 5). */
const BOKEH_LIFT = 0.35;
export const MAX_SPRITES = 2 * MAX_PARTICLES + MAX_BOKEH + MAX_MOOD_SPRITES;
/** Per sprite: x, y, size, alpha, r, g, b, kind (0 ember, 1 star, 2 bokeh, 3+ ambience: MOOD_KIND). */
export const SPRITE_FLOATS = 8;

type Values = Readonly<Record<string, number | boolean | string>>;
const num = (v: Values | undefined, k: string, d: number) =>
  typeof v?.[k] === "number" ? (v[k] as number) : d;
const ease = (t: number) => t * t * (3 - 2 * t);

function rgb(hex: unknown, fallback: readonly number[]): [number, number, number] {
  if (typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex)) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
  }
  return [fallback[0]! / 255, fallback[1]! / 255, fallback[2]! / 255];
}

/** The tide of the palette (paletteTween.ts), as the sprites need it. */
export interface TideMix {
  weight(x: number, y: number): number;
  fromColours(): { a: readonly number[]; b: readonly number[] } | null;
}

export class Scene {
  readonly sprites = new Float32Array(MAX_SPRITES * SPRITE_FLOATS);
  private readonly tmp = [0, 0, 0];
  count = 0;
  /** Steps 16–17: the shown game's ambience, written after the theme's own sprites. */
  readonly mood = new MoodSim();
  private moves = false;
  /** Slow drifts (veils, bands, bokeh, moon) run; false = still picture. */
  drifting = false;
  time = 0;
  private readonly embers = new Float32Array(MAX_PARTICLES * STRIDE);
  private readonly stars = new Float32Array(MAX_PARTICLES * STRIDE);
  private nEmbers = 0;
  private nStars = 0;
  private nBokeh = 0;
  private still = false;

  configure(params: FxParams, quality: Quality, reduced: boolean): void {
    const b = budgetFor(quality, reduced);
    const share = (v: Values | undefined) =>
      v?.on === true ? Math.min(MAX_PARTICLES, Math.round(num(v, "count", 0) * b.particles)) : 0;
    this.still = reduced;
    this.nEmbers = reduced ? 0 : share(params.embers);
    this.nStars = reduced
      ? Math.min(MAX_PARTICLES, params.stars?.on === true ? num(params.stars, "count", 0) : 0)
      : share(params.stars);
    const bk = params.bokeh;
    const nBokeh = bk?.on === true ? Math.min(MAX_BOKEH, Math.round(num(bk, "count", 0))) : 0;
    this.nBokeh = quality === "eco" ? Math.min(ECO_BOKEH, nBokeh) : nBokeh;
    seedEmbers(this.embers, this.nEmbers, params.embers);
    seedStars(this.stars, this.nStars, params.stars);
    this.drifting = b.fog === "animated";
    this.moves = !reduced && (this.drifting || this.nEmbers + this.nStars > 0);
    this.mood.configure(quality, reduced);
  }

  /** Something moves on its own: the background needs ambient frames. */
  get animated(): boolean {
    return this.moves || this.mood.animated;
  }

  step(dt: number): void {
    this.mood.step(dt);
    if (this.still) return;
    if (this.drifting) this.time += dt;
    advance(this.embers, this.nEmbers, dt);
    advance(this.stars, this.nStars, dt);
  }

  /**
   * Fills the instance buffer for a viewport of W × H CSS px. During a tide (step 14) each sprite
   * mixes the old palette's colour with the new one by its distance to the tide's centre.
   */
  fill(
    params: FxParams,
    palette: FxPalette,
    W: number,
    H: number,
    k: number,
    tide: TideMix | null = null,
  ): void {
    const s = this.sprites;
    let n = 0;
    const old = tide?.fromColours() ?? null;
    const tmp = this.tmp;
    /** `to` towards `from` (0–1 colours) outside the tide, written into a scratch array. */
    const at = (to: number[], from: number[] | null, x: number, y: number): number[] => {
      const w = from && tide ? tide.weight(x, y) : 1;
      if (w >= 1 || !from) return to;
      for (let j = 0; j < 3; j++) tmp[j] = from[j]! + (to[j]! - from[j]!) * w;
      return tmp;
    };
    const put = (x: number, y: number, size: number, a: number, c: number[], kind: number) => {
      const o = n++ * SPRITE_FLOATS;
      s[o] = x;
      s[o + 1] = y;
      s[o + 2] = size;
      s[o + 3] = a * k;
      s[o + 4] = c[0]!;
      s[o + 5] = c[1]!;
      s[o + 6] = c[2]!;
      s[o + 7] = kind;
    };
    const ev = params.embers;
    const ember = rgb(ev?.color, palette.b);
    const emberOld = old && typeof ev?.color !== "string" ? rgb("", old.b) : null;
    const rise = num(ev, "rise", 220);
    const glow = num(ev, "glow", 8);
    for (let i = 0; i < this.nEmbers; i++) {
      const o = i * STRIDE;
      const p = this.embers[o + 4]!;
      const t = ease(p);
      const size = this.embers[o + 2]! + 2 * glow;
      const x = this.embers[o]! * W + 24 * t;
      const y = this.embers[o + 1]! * H - rise * t;
      put(x, y, size, emberAlpha(p), at(ember, emberOld, x, y), 0);
    }
    const glowA = rgb("", palette.a);
    const glowOld = old ? rgb("", old.a) : null;
    for (let i = 0; i < this.nStars; i++) {
      const o = i * STRIDE;
      const u = this.still ? 0.55 : twinkle(this.stars[o + 4]!);
      const size = this.stars[o + 2]! * (0.6 + 0.4 * u) * 4;
      const x = this.stars[o]! * W;
      const y = this.stars[o + 1]! * H;
      put(x, y, size, 0.15 + 0.8 * u, at(glowA, glowOld, x, y), 1);
    }
    const bk = params.bokeh;
    const top = num(bk, "zoneTop", 8) / 100;
    const zh = num(bk, "zoneH", 80) / 100;
    const bs = num(bk, "size", 120);
    const bi = num(bk, "intensity", 0.09);
    const ca = palette.a;
    const cb = palette.b;
    for (let i = 0; i < this.nBokeh; i++) {
      const a = hash(i, 17.13, 43758.5);
      const b = hash(i, 63.71, 24634.6);
      const c = hash(i, 9.37, 15731.7);
      const ph = this.time / (40000 + 30000 * c) + a;
      const x = (0.04 + 0.92 * a) * W + Math.sin(ph * 2 * Math.PI) * 30;
      const y = (top + b * zh) * H + Math.cos(ph * 2 * Math.PI) * 14;
      // A → B lightened towards white (round 5): at a low additive alpha a plain mix turns grey.
      const lift = (p: readonly number[], q: readonly number[]) =>
        [0, 1, 2].map((j) => ((p[j]! + (q[j]! - p[j]!) * c) / 255) * (1 - BOKEH_LIFT) + BOKEH_LIFT);
      const mix = lift(ca, cb);
      const breathe = 0.75 + 0.25 * Math.sin((ph * 3 + b) * 2 * Math.PI);
      const colour = at(mix, old ? lift(old.a, old.b) : null, x, y);
      put(x, y, bs * (0.5 + a), bi * (0.5 + 0.5 * b) * breathe, colour, 2);
    }
    n += this.mood.fill(s, n, MAX_SPRITES - n, palette, W, H, k);
    this.count = n;
  }
}
