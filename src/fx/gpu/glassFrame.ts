import {
  chainOpacity,
  glassEntries,
  glassFloatOf,
  MAX_GLASS,
  parseRadius,
  radiusPx,
  type GlassEntry,
  type GlassKind,
} from "../../design/glass/glassRegistry";
import { parseColor } from "../../lib/color";
import type { GlassPose } from "./cues";
import type { PosterTextures } from "./posterTextures";

/** Posters drawn by the engine this frame (null = none: off, fallen back, no texture support). */
export interface PosterPass {
  textures: PosterTextures;
  /** Opacity of the poster in a carousel card, inset of the poster inside the rim (CSS px). */
  opacity: number;
  inset: number;
}

/** Index of each kind in the shader's per-kind arrays. */
export const KIND_INDEX: Readonly<Record<GlassKind, number>> = {
  card: 0,
  bar: 1,
  dock: 2,
  button: 3,
  pill: 4,
};

/** Tint of the non-card glass: the darkest background colour of the theme. */
function themeTint(): [number, number, number] {
  const c = parseColor(getComputedStyle(document.documentElement).getPropertyValue("--bg-bottom"));
  return c ? [c.r / 255, c.g / 255, c.b / 255] : [0.03, 0.02, 0.05];
}

/** Where the glass tints of cards and pills come from (step 14: the palette, see paletteTween.ts). */
export interface TintSource {
  tint(kind: GlassKind, base: readonly number[], x: number, y: number): readonly number[];
}

/**
 * Static info of an entry (radius, style chain, clipping ancestor, depth, tint). Cards and pills
 * keep only their shade here (cards: `--k`, pills: 1); their colour comes from the palette at each
 * frame (step 14: no more reading of `--card` / `--accent`, and the tide can pass over them).
 */
function refresh(e: GlassEntry, dark: [number, number, number]): void {
  const cs = getComputedStyle(e.el);
  e.radius = parseRadius(cs.borderTopLeftRadius);
  e.chain = [];
  for (let a: Element | null = e.el; a && a !== document.documentElement; a = a.parentElement) {
    e.chain.push(getComputedStyle(a));
  }
  e.clip = null;
  for (let p = e.el.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (s.overflowX !== "visible" || s.overflowY !== "visible") {
      e.clip = p;
      break;
    }
  }
  e.depth = e.el.parentElement?.closest("[data-glass-kind]") ? 1 : 0;
  if (e.kind === "card") {
    const k = parseFloat(cs.getPropertyValue("--k")) || 1;
    e.tint = [k, k, k];
  } else if (e.kind === "pill") e.tint = [1, 1, 1];
  else e.tint = dark;
  e.dirty = false;
}

/**
 * The glass shapes of one frame, measured in the DOM (viewport CSS px) into the shader's uniform
 * arrays. Elements of a kind the engine does not draw (fallback, kind off) keep their CSS look.
 *
 * Round 3b: an element with a pose (cues.ts) is drawn from it (rotated, scaled, softened); posed
 * elements with a stack order come last, back to front, and are never merged (`ns` = merged ones).
 */
export class GlassFrame {
  readonly R = new Float32Array(MAX_GLASS * 4);
  readonly S = new Float32Array(MAX_GLASS * 4);
  readonly T = new Float32Array(MAX_GLASS * 4);
  readonly C = new Float32Array(MAX_GLASS * 4);
  /** Per shape: poster texture slot (−1 none), picture aspect (w / h), opacity, inset (px). */
  readonly P = new Float32Array(MAX_GLASS * 4);
  /** Per shape: cos, sin of its angle, edge softness (px), stack order (0 = merged). */
  readonly X = new Float32Array(MAX_GLASS * 4);
  n = 0;
  /** Shapes [0, ns) are merged; [ns, n) are stacked, back to front. */
  ns = 0;
  /** Index of the hovered card of the fan (threads, sparks), −1 = none. */
  hover = -1;
  private hoverEl: Element | null = null;
  nested = 0;
  /** Selected card whose inside the engine draws (no DOM poster over it): centre, half size. */
  private readonly prev = new Float32Array(MAX_GLASS * 12);
  private prevN = -1;
  private prevHover = -1;
  private readonly prevP = new Float32Array(MAX_GLASS);
  private readonly clips = new Map<HTMLElement, DOMRect>();
  private readonly stacked: { e: GlassEntry; pose: GlassPose }[] = [];
  private colours: TintSource | null = null;

  /** Measures every drawn element; true when a shape moved or changed since the last call. */
  measure(
    drawn: (kind: GlassKind) => boolean,
    tint: (kind: GlassKind) => number,
    posters: PosterPass | null = null,
    poses: ReadonlyMap<Element, GlassPose> | null = null,
    hoverEl: Element | null = null,
    colours: TintSource | null = null,
  ): boolean {
    let dark: [number, number, number] | null = null;
    this.colours = colours;
    this.hoverEl = hoverEl;
    this.hover = -1;
    this.clips.clear();
    this.stacked.length = 0;
    this.n = 0;
    this.nested = 0;
    for (const e of glassEntries()) {
      const on = drawn(e.kind) && this.n + this.stacked.length < MAX_GLASS;
      if (!on) {
        if (e.el.dataset.glass) delete e.el.dataset.glass;
        if (e.el.dataset.glassPoster) delete e.el.dataset.glassPoster;
        continue;
      }
      if (e.el.dataset.glass !== "gpu") e.el.dataset.glass = "gpu";
      if (e.dirty) refresh(e, (dark ??= themeTint()));
      const pose = poses?.get(e.el);
      if (pose && pose.z > 0) this.stacked.push({ e, pose });
      else this.put(e, tint, posters, pose ?? null);
    }
    this.ns = this.n;
    this.stacked.sort((a, b) => a.pose.z - b.pose.z);
    for (const { e, pose } of this.stacked) this.put(e, tint, posters, pose);
    const n = this.n;
    let changed = n !== this.prevN || this.hover !== this.prevHover;
    this.prevHover = this.hover;
    const M = MAX_GLASS * 4;
    for (let i = 0; i < n * 4 && !changed; i++) {
      if (this.R[i] !== this.prev[i] || this.S[i] !== this.prev[M + i]) changed = true;
      if (this.X[i] !== this.prev[2 * M + i]) changed = true;
      if (i % 4 === 0 && this.P[i] !== this.prevP[i >> 2]) changed = true;
    }
    this.prev.set(this.R.subarray(0, n * 4), 0);
    this.prev.set(this.S.subarray(0, n * 4), M);
    this.prev.set(this.X.subarray(0, n * 4), 2 * M);
    for (let i = 0; i < n; i++) this.prevP[i] = this.P[i * 4]!;
    this.prevN = n;
    return changed;
  }

  /** Writes one shape at index `n` (skipped when hidden or empty). */
  private put(
    e: GlassEntry,
    tint: (kind: GlassKind) => number,
    posters: PosterPass | null,
    pose: GlassPose | null,
  ): void {
    if (e.chain[0]?.visibility === "hidden") return;
    const opacity = chainOpacity(e.chain);
    if (opacity <= 0.005) return;
    let cx: number, cy: number, hw: number, hh: number, radius: number, scale: number;
    const float = pose ? undefined : glassFloatOf(e.el);
    if (pose) {
      ({ x: cx, y: cy, hw, hh, r: radius } = pose);
      scale = e.el.offsetWidth > 0 ? (2 * hw) / e.el.offsetWidth : 1;
    } else {
      const r = e.el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      const ow = e.el.offsetWidth;
      hw = r.width / 2;
      hh = r.height / 2;
      scale = ow > 0 ? r.width / ow : 1;
      // A rocked card (round 5): its box is its bounding box; its true size, from its proportions.
      const oh = e.el.offsetHeight;
      if (float && ow > 0 && oh > 0) {
        const c = Math.abs(Math.cos(float.rot));
        const sn = Math.abs(Math.sin(float.rot));
        scale = r.width / (ow * c + oh * sn);
        hw = (ow * scale) / 2;
        hh = (oh * scale) / 2;
      }
      radius = radiusPx(e.radius, hw, hh, scale);
    }
    if (hw < 0.5 || hh < 0.5) return;
    const o = this.n * 4;
    this.R.set([cx, cy, hw, hh], o);
    this.S.set([radius, KIND_INDEX[e.kind], opacity, e.depth], o);
    const c = this.colours ? this.colours.tint(e.kind, e.tint, cx, cy) : e.tint;
    this.T.set([c[0]!, c[1]!, c[2]!, tint(e.kind)], o);
    // .w: stack order + the floating height (round 5) in its fraction (the shader reads `fract`).
    const elev = Math.min(0.99, Math.max(0, pose?.elev ?? float?.elev ?? 0));
    const a = pose?.a ?? float?.rot ?? 0;
    this.X.set([Math.cos(a), Math.sin(a), pose?.soft ?? 0, (pose?.z ?? 0) + elev], o);
    let clip: DOMRect | undefined;
    if (e.clip) {
      clip = this.clips.get(e.clip);
      if (!clip) this.clips.set(e.clip, (clip = e.clip.getBoundingClientRect()));
    }
    if (clip) this.C.set([clip.left, clip.top, clip.right, clip.bottom], o);
    else this.C.set([-1e5, -1e5, 1e5, 1e5], o);
    // Carousel cards only (`data-stage`): the grid can show far more cards than texture units.
    const url =
      posters && e.kind === "card" && e.el.dataset.stage !== undefined && e.el.dataset.poster;
    const slot = url ? posters.textures.slotFor(url) : -1;
    if (slot >= 0) {
      const pa = posters!;
      this.P.set([slot, pa.textures.aspect(slot), pa.opacity, pa.inset * scale], o);
      if (e.el.dataset.glassPoster !== "gpu") e.el.dataset.glassPoster = "gpu";
    } else {
      this.P.set([-1, 1, 0, 0], o);
      if (e.el.dataset.glassPoster) delete e.el.dataset.glassPoster;
    }
    if (e.depth) this.nested++;
    if (e.el === this.hoverEl) this.hover = this.n;
    this.n++;
  }

  /** Gives every element its CSS look back (engine off or fallen back). */
  static unmarkAll(): void {
    for (const e of glassEntries()) {
      delete e.el.dataset.glass;
      delete e.el.dataset.glassPoster;
    }
  }
}
