import type { Quality } from "../../design";
import type { ColorRole } from "../../ipc/bindings";
import type { FxPalette, FxTarget } from "../FxLayer";
import { hash } from "../hash";
import type { FxMood, Mood, MoodLayerDef } from "./types";

/**
 * Simulation of a game ambience (steps 16–17): no DOM, no allocation per frame. Every position is
 * a function of the ambience's own clock (seeded by `hash`), written as sprites in the glass
 * engine's format (x, y, size, alpha, r, g, b, kind: src/fx/gpu/scene.ts), so the glass refracts
 * them like the theme's embers; the Canvas 2D fallback (moodCanvas.ts) draws the same list.
 */
export const MOOD_KIND = {
  ember: 0,
  star: 1,
  soft: 3,
  streak: 4,
  beam: 5,
  ring: 6,
  /** Glyph i of the atlas: 8 + i. */
  glyph: 8,
} as const;
export const MAX_MOOD_SPRITES = 160;
/** Share of each layer's particles by quality (Éco: no ambience at all). */
export const MOOD_SHARE: Record<Quality, number> = { eco: 0, balanced: 0.6, high: 1, ultra: 1.25 };
/** Old ambience out, new one in (ms). */
export const MOOD_FADE = { out: 350, in: 650 } as const;
/**
 * Height of a ring of glyphs × its width (30/10: 0.3 → 0.62): the ring goes round the shown card,
 * above and below it, instead of hiding behind the side cards.
 */
const RING_TILT = 0.62;
/** Clock of a still picture (« réduire les animations »), s. */
const STILL_T = 7.3;

const TEXT: readonly number[] = [0.96, 0.94, 0.91];
const TAU = Math.PI * 2;
const ease = (t: number) => t * t * (3 - 2 * t);

function colourOf(role: ColorRole, p: FxPalette, out: number[]): number[] {
  const c = role === "accent" ? p.b : p.a;
  const k = role === "dark" ? 0.25 / 255 : 1 / 255;
  if (role === "text") {
    out[0] = TEXT[0]!;
    out[1] = TEXT[1]!;
    out[2] = TEXT[2]!;
  } else for (let j = 0; j < 3; j++) out[j] = c[j]! * k;
  return out;
}

/** Opacity along a particle's life: in over 15 %, out over the last 40 %. */
export function lifeAlpha(p: number): number {
  if (p < 0.15) return ease(p / 0.15);
  if (p > 0.6) return 1 - ease((p - 0.6) / 0.4);
  return 1;
}

export class MoodSim {
  focus: FxTarget | null = null;
  private def: FxMood | null = null;
  private pending: FxMood | null | undefined = undefined;
  private share = 1;
  private reduced = false;
  /** The ambience's clock (s, × its speed) and its opacity during a change. */
  private t = 0;
  private alpha = 0;
  private fadeMs = 0;
  private fading: "out" | "in" | null = null;
  private focusA = 0;
  private readonly c = [0, 0, 0];
  /** Glyph names of the current ambience, in atlas order; `version` changes with them. */
  glyphs: readonly string[] = [];
  glyphPaths: readonly string[] = [];
  version = 0;

  configure(quality: Quality, reduced: boolean): void {
    this.share = MOOD_SHARE[quality];
    this.reduced = reduced;
    if (reduced) this.t = STILL_T;
  }

  /** A new ambience (or none): the old one fades out, then the new one in. Same one: kept. */
  set(m: FxMood | null): void {
    if (same(m, this.pending !== undefined ? this.pending : this.def)) return;
    if (this.reduced) {
      this.swap(m);
      this.alpha = m ? 1 : 0;
      this.fading = null;
      return;
    }
    if (!this.def) {
      this.swap(m);
      this.alpha = 0;
      this.fadeMs = 0;
      this.fading = m ? "in" : null;
      return;
    }
    // Only the dosage changed: no fade.
    if (m && m.mood === this.def.mood && this.pending === undefined) return this.swap(m);
    this.pending = m;
    if (this.fading !== "out") {
      this.fading = "out";
      this.fadeMs = (1 - this.alpha) * MOOD_FADE.out;
    }
  }

  private swap(m: FxMood | null): void {
    const before = this.def?.mood;
    this.def = m;
    this.pending = undefined;
    if (m?.mood !== before) {
      const names = m ? Object.keys(m.mood.glyphs).slice(0, 8) : [];
      this.glyphs = names;
      this.glyphPaths = names.map((n) => m!.mood.glyphs[n]!);
      this.version++;
      if (!this.reduced) this.t = 0;
    }
  }

  /** Draws something now (an ambience shown, or one fading). */
  get active(): boolean {
    return (this.def !== null && this.share > 0) || this.fading !== null;
  }

  /** Moves on its own: the engine keeps its ambient frames. */
  get animated(): boolean {
    return this.active && !this.reduced;
  }

  step(dt: number): void {
    if (this.fading) {
      this.fadeMs += dt;
      const ms = this.fading === "out" ? MOOD_FADE.out : MOOD_FADE.in;
      const u = Math.min(1, this.fadeMs / ms);
      this.alpha = this.fading === "out" ? 1 - u : u;
      if (u >= 1) {
        this.fadeMs = 0;
        if (this.fading === "out") {
          this.swap(this.pending ?? null);
          this.fading = this.def ? "in" : null;
          this.alpha = 0;
        } else this.fading = null;
      }
    }
    // What hangs on the focus fades with it (300 ms).
    const want = this.focus ? 1 : 0;
    this.focusA += Math.sign(want - this.focusA) * Math.min(Math.abs(want - this.focusA), dt / 300);
    if (this.reduced) this.focusA = want;
    if (!this.reduced && this.def) this.t += (dt / 1000) * this.def.speed;
  }

  /**
   * Writes the ambience's sprites into `out` from sprite `start` (8 floats each), at most `room`;
   * returns how many. `k`: the atmosphere's intensity.
   */
  fill(
    out: Float32Array,
    start: number,
    room: number,
    p: FxPalette,
    W: number,
    H: number,
    k: number,
  ): number {
    const m = this.def;
    if (!m || this.share <= 0 || this.alpha <= 0) return 0;
    let n = 0;
    const max = Math.min(room, MAX_MOOD_SPRITES);
    const put = (x: number, y: number, size: number, a: number, c: number[], kind: number) => {
      if (n >= max || a <= 0.002) return;
      const o = (start + n++) * 8;
      out[o] = x;
      out[o + 1] = y;
      out[o + 2] = size;
      out[o + 3] = a * k * this.alpha;
      out[o + 4] = c[0]!;
      out[o + 5] = c[1]!;
      out[o + 6] = c[2]!;
      out[o + 7] = kind;
    };
    m.mood.layers.forEach((layer, li) => this.layer(layer, li, m, p, W, H, put));
    return n;
  }

  private layer(
    l: MoodLayerDef,
    li: number,
    m: FxMood,
    p: FxPalette,
    W: number,
    H: number,
    put: (x: number, y: number, s: number, a: number, c: number[], kind: number) => void,
  ): void {
    const c = colourOf(l.colorRole, p, this.c);
    const t = this.t;
    const f = this.focus;
    const cx = f ? f.x : W / 2;
    const cy = f ? (f.top + f.bottom) / 2 : H * 0.55;
    const cardH = f ? f.bottom - f.top : H * 0.3;
    switch (l.type) {
      case "particles": {
        const count = Math.min(80, Math.round(l.count * this.share * m.density));
        const kind = kindOf(l, m.mood);
        const [dx, dy] = DIR[l.direction];
        for (let i = 0; i < count; i++) {
          const a = hash(i + 1, 12.9898 + li, 43758.5);
          const b = hash(i + 1, 78.233 + li, 24634.6);
          const life = lerp(l.life[0], l.life[1], hash(i + 1, 39.346 + li, 12543.1));
          const speed = lerp(l.speed[0], l.speed[1], b);
          const ph = (t / life + a) % 1;
          const travel = speed * life * ph;
          const sway = l.drift * 30 * Math.sin(TAU * (ph * 1.5 + b));
          const x = wrap(a * W + dx * travel + sway * Math.abs(dy), W);
          const y = wrap(b * H + dy * travel + sway * Math.abs(dx), H);
          const size = lerp(l.size[0], l.size[1], hash(i + 1, 4.898 + li, 7563.2));
          const twinkle = l.shape === "star" ? 0.35 + 0.65 * Math.sin(Math.PI * ph) : lifeAlpha(ph);
          put(x, y, size * SPRITE_SCALE[l.shape], l.opacity * twinkle, c, kind);
        }
        return;
      }
      case "glyphRing": {
        const kind = MOOD_KIND.glyph + Math.max(0, this.glyphs.indexOf(l.glyph));
        const r = l.radius * H;
        const spin = (l.rotation * Math.PI) / 180;
        for (let i = 0; i < l.count; i++) {
          const ang = (TAU * i) / l.count + spin * t;
          const depth = Math.sin(ang);
          const a = l.opacity * this.focusA * (0.55 + 0.45 * (depth * 0.5 + 0.5));
          const breathe = 0.85 + 0.15 * Math.sin(t * 1.3 + i);
          put(
            cx + r * Math.cos(ang),
            cy + r * RING_TILT * depth,
            l.size * (0.8 + 0.2 * depth),
            a * breathe,
            c,
            kind,
          );
        }
        return;
      }
      case "mist":
        for (let i = 0; i < l.count; i++) {
          const a = hash(i + 1, 91.7 + li, 43758.5);
          const size = W * (0.35 + 0.25 * a);
          const x = wrap(a * (W + size) + l.speed * t * (i % 2 ? 1 : -0.7), W + size) - size / 2;
          const y = H * (0.6 + 0.35 * hash(i + 1, 17.3 + li, 24634.6));
          put(
            x,
            y,
            size,
            l.opacity * (0.75 + 0.25 * Math.sin(t * 0.21 + i * 2.1)),
            c,
            MOOD_KIND.soft,
          );
        }
        return;
      case "beam":
        for (let i = 0; i < l.count; i++) {
          const a = hash(i + 1, 5.13 + li, 43758.5);
          const lean = Math.tan((l.sway * Math.PI) / 180) * H * 0.4;
          const x =
            W * (0.15 + 0.7 * (l.count > 1 ? i / (l.count - 1) : 0.5)) +
            lean * Math.sin(t / (6 + 4 * a) + a * TAU);
          put(
            x,
            H * 0.35,
            H * 1.3,
            l.opacity * (0.7 + 0.3 * Math.sin(t * 0.37 + i)),
            c,
            MOOD_KIND.beam,
          );
        }
        return;
      case "pulse": {
        const u = 0.5 + 0.5 * Math.sin((TAU * t) / l.period);
        put(
          cx,
          cy,
          cardH * (1.45 + 0.08 * u),
          l.opacity * this.focusA * (0.45 + 0.55 * u),
          c,
          MOOD_KIND.ring,
        );
        return;
      }
    }
  }
}

const DIR = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  none: [0, 0],
} as const;

/** Quad side × a shape's size (its sprite keeps a glow around the core). */
const SPRITE_SCALE = { ember: 3, dot: 3, star: 4, line: 1, glyph: 1 } as const;

function kindOf(l: Extract<MoodLayerDef, { type: "particles" }>, mood: Mood): number {
  switch (l.shape) {
    case "ember":
      return MOOD_KIND.ember;
    case "star":
      return MOOD_KIND.star;
    case "line":
      return MOOD_KIND.streak;
    case "glyph": {
      const i = Object.keys(mood.glyphs)
        .slice(0, 8)
        .indexOf(l.glyph ?? "");
      return i < 0 ? MOOD_KIND.soft : MOOD_KIND.glyph + i;
    }
    default:
      return MOOD_KIND.soft;
  }
}

function same(a: FxMood | null, b: FxMood | null): boolean {
  if (!a || !b) return a === b;
  return a.mood === b.mood && a.density === b.density && a.speed === b.speed;
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const wrap = (v: number, m: number) => ((v % m) + m) % m;
