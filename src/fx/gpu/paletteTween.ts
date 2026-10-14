import { GAME_COLORS, tideCurve, tideReachPx } from "../../design/motion/tokens14";
import type { GlassKind } from "../../design/glass/glassRegistry";
import type { FxPalette, FxTarget } from "../FxLayer";
import { rgb01 } from "./gl";
import type { Uniforms } from "./renderer";

type Rgb = readonly [number, number, number];
const unit = (c: Rgb): [number, number, number] => [c[0] / 255, c[1] / 255, c[2] / 255];
const mix = (p: readonly number[], q: readonly number[], w: number) =>
  [0, 1, 2].map((i) => p[i]! + (q[i]! - p[i]!) * w);

/** Far enough that every point is inside: no tide. */
const NONE = 1e6;

function same(p: FxPalette, q: FxPalette): boolean {
  const eq = (x?: readonly unknown[], y?: readonly unknown[]) =>
    (x ?? []).length === (y ?? []).length && (x ?? []).every((v, i) => v === y?.[i]);
  return eq(p.a, q.a) && eq(p.b, q.b) && eq(p.bg, q.bg) && eq(p.card, q.card);
}

/**
 * Passage from one palette to the next (step 14, V7 c « marée »): the new colours spread in a circle
 * from the selected card (`focus`), with a band of light on its edge. Everything is mixed by the
 * distance to the centre: the background in its shader (old palette as `u…0`), the sprites and the
 * glass tints here. A tide that starts while another runs takes over from where that one was going.
 */
export class PaletteTween {
  private from: FxPalette | null = null;
  private to: FxPalette | null = null;
  private start = -1;
  private ms: number = GAME_COLORS.tide.ms;
  private x = 0;
  private y = 0;
  private reach = 1;
  private target: FxTarget | null = null;
  /** Current radius of the tide (px) and opacity of its band. */
  private radius = NONE;
  private band = 0;
  /** « Fondu »: the share of the new colours, the same everywhere (1 = none running). */
  private fade = 1;
  private fading = false;

  focus(target: FxTarget | null): void {
    this.target = target;
  }

  /** A new palette; plays the tide when it asks for one and anything changes. */
  set(p: FxPalette, W: number, H: number, speed: number, reduced: boolean, now: number): void {
    const t = this.target;
    const moves = !reduced && this.to !== null && !same(this.to, p);
    const tide = moves && p.passage === "tide" && t !== null;
    const fade = moves && p.passage === "fade";
    this.from = tide || fade ? this.to : p;
    this.to = p;
    if (fade) {
      this.stop(false);
      this.fading = true;
      this.fade = 0;
      this.ms = GAME_COLORS.fade.ms / Math.max(0.1, speed);
      this.start = now;
      return;
    }
    if (!tide || !t) {
      this.stop();
      return;
    }
    this.x = t.x;
    this.y = (t.top + t.bottom) / 2;
    this.reach = tideReachPx(this.x, this.y, W, H);
    this.ms = GAME_COLORS.tide.ms / Math.max(0.1, speed);
    this.start = now;
    this.radius = 0;
    this.band = GAME_COLORS.tide.band;
  }

  /** The tide is running: the engine needs every frame until it ends. */
  get running(): boolean {
    return this.start >= 0;
  }

  /** Advances the tide to `now`; true when it has just ended (one more frame: the far corners). */
  step(now: number): boolean {
    if (this.start < 0) return false;
    const k = (now - this.start) / this.ms;
    if (k >= 1) {
      this.stop();
      return true;
    }
    if (this.fading) {
      this.fade = tideCurve()(Math.max(0, k));
      return false;
    }
    const { band, full } = GAME_COLORS.tide;
    this.radius = tideCurve()(Math.max(0, k)) * this.reach;
    this.band = band * (k < full ? 1 : 1 - (k - full) / (1 - full));
    return false;
  }

  /** Ends any passage; `settle`: the old palette is forgotten (false: a fade starts from it). */
  private stop(settle = true): void {
    this.start = -1;
    if (settle) this.from = this.to;
    this.radius = NONE;
    this.band = 0;
    this.fade = 1;
    this.fading = false;
  }

  /** Share of the new colours at (x, y): 1 inside the tide, 0 outside, a soft edge between. */
  weight(x: number, y: number): number {
    if (this.start < 0) return 1;
    if (this.fading) return this.fade;
    const d = Math.hypot(x - this.x, y - this.y);
    return Math.min(1, Math.max(0, (this.radius - d) / GAME_COLORS.tide.softPx));
  }

  /** The old palette's A and B while the tide runs (sprites mix them by `weight`); else null. */
  fromColours(): { a: Rgb; b: Rgb } | null {
    return this.start >= 0 && this.from ? { a: this.from.a, b: this.from.b } : null;
  }

  /**
   * Glass tint of a shape at (x, y), 0–1. Cards: their colour × their shade (`base` = [k, k, k]);
   * selection pills: a pale tint of A; the rest keep `base` (the theme's darkest colour).
   */
  tint(kind: GlassKind, base: readonly number[], x: number, y: number): readonly number[] {
    const to = this.to;
    if (!to || (kind !== "card" && kind !== "pill")) return base;
    const w = this.weight(x, y);
    const of = (p: FxPalette) => unit(kind === "card" ? (p.card ?? p.a) : p.a);
    const c = this.from && w < 1 ? mix(of(this.from), of(to), w) : of(to);
    return kind === "card" ? c.map((v, i) => v * base[i]!) : c.map((v) => 0.75 + 0.25 * v);
  }

  /** Background shader: the old palette and the tide (centre, radius, band; soft edge, band width). */
  uniforms(): Uniforms {
    const f = this.from ?? this.to;
    const bg = (f?.bg ?? []).map(rgb01);
    return {
      uA0: f ? unit(f.a) : [0, 0, 0],
      uB0: f ? unit(f.b) : [0, 0, 0],
      uBg00: bg[0] ?? [0, 0, 0],
      uBg01: bg[1] ?? [0, 0, 0],
      uBg02: bg[2] ?? [0, 0, 0],
      uTide: [this.x, this.y, this.radius, this.band],
      uTideW: [GAME_COLORS.tide.softPx, GAME_COLORS.tide.bandPx, this.fade],
    };
  }
}
