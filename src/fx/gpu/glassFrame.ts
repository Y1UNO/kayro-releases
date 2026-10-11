import {
  chainOpacity,
  glassEntries,
  MAX_GLASS,
  parseRadius,
  radiusPx,
  type GlassEntry,
  type GlassKind,
} from "../../design/glass/glassRegistry";
import { parseColor } from "../../lib/color";
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

/** Static info of an entry (radius, style chain, clipping ancestor, depth, tint). */
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
    const c = parseColor(cs.getPropertyValue("--card"));
    const k = parseFloat(cs.getPropertyValue("--k")) || 1;
    e.tint = c ? [(c.r / 255) * k, (c.g / 255) * k, (c.b / 255) * k] : dark;
  } else if (e.kind === "pill") {
    // A selection reads lighter than its bar: a pale tint of the theme colour.
    const a = parseColor(cs.getPropertyValue("--accent"));
    const m = (x: number | undefined) => 0.75 + 0.25 * ((x ?? 255) / 255);
    e.tint = [m(a?.r), m(a?.g), m(a?.b)];
  } else e.tint = dark;
  e.dirty = false;
}

/**
 * The glass shapes of one frame, measured in the DOM (viewport CSS px) into the shader's uniform
 * arrays. Elements of a kind the engine does not draw (fallback, kind off) keep their CSS look.
 */
export class GlassFrame {
  readonly R = new Float32Array(MAX_GLASS * 4);
  readonly S = new Float32Array(MAX_GLASS * 4);
  readonly T = new Float32Array(MAX_GLASS * 4);
  readonly C = new Float32Array(MAX_GLASS * 4);
  /** Per shape: poster texture slot (−1 none), picture aspect (w / h), opacity, inset (px). */
  readonly P = new Float32Array(MAX_GLASS * 4);
  n = 0;
  nested = 0;
  /** Selected card whose inside the engine draws (no DOM poster over it): centre, half size. */
  readonly sel = new Float32Array(4);
  hasSel = false;
  private readonly prev = new Float32Array(MAX_GLASS * 8);
  private prevN = -1;
  private readonly prevP = new Float32Array(MAX_GLASS);
  private readonly clips = new Map<HTMLElement, DOMRect>();

  /** Measures every drawn element; true when a shape moved or changed since the last call. */
  measure(
    drawn: (kind: GlassKind) => boolean,
    tint: (kind: GlassKind) => number,
    posters: PosterPass | null = null,
  ): boolean {
    let dark: [number, number, number] | null = null;
    this.clips.clear();
    let n = 0;
    let nested = 0;
    this.hasSel = false;
    for (const e of glassEntries()) {
      const on = drawn(e.kind) && n < MAX_GLASS;
      if (!on) {
        if (e.el.dataset.glass) delete e.el.dataset.glass;
        if (e.el.dataset.glassPoster) delete e.el.dataset.glassPoster;
        continue;
      }
      if (e.el.dataset.glass !== "gpu") e.el.dataset.glass = "gpu";
      if (e.dirty) refresh(e, (dark ??= themeTint()));
      if (e.chain[0]?.visibility === "hidden") continue;
      const opacity = chainOpacity(e.chain);
      if (opacity <= 0.005) continue;
      const r = e.el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const hw = r.width / 2;
      const hh = r.height / 2;
      const scale = e.el.offsetWidth > 0 ? r.width / e.el.offsetWidth : 1;
      const o = n * 4;
      this.R.set([r.left + hw, r.top + hh, hw, hh], o);
      this.S.set([radiusPx(e.radius, hw, hh, scale), KIND_INDEX[e.kind], opacity, e.depth], o);
      this.T.set([e.tint[0], e.tint[1], e.tint[2], tint(e.kind)], o);
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
      if (e.depth) nested++;
      // Glossy veil (round 2b): on the selected card, unless a DOM poster hides its inside (the
      // CSS veil of SheenVeil.tsx is drawn above that poster instead).
      if (
        e.kind === "card" &&
        !this.hasSel &&
        e.el.getAttribute("aria-selected") === "true" &&
        (!e.el.hasAttribute("data-poster") || e.el.dataset.glassPoster === "gpu")
      ) {
        this.sel.set([r.left + hw, r.top + hh, hw, hh]);
        this.hasSel = true;
      }
      n++;
    }
    this.n = n;
    this.nested = nested;
    let changed = n !== this.prevN;
    for (let i = 0; i < n * 4 && !changed; i++) {
      if (this.R[i] !== this.prev[i] || this.S[i] !== this.prev[MAX_GLASS * 4 + i]) changed = true;
      if (i % 4 === 0 && this.P[i] !== this.prevP[i >> 2]) changed = true;
    }
    this.prev.set(this.R.subarray(0, n * 4), 0);
    this.prev.set(this.S.subarray(0, n * 4), MAX_GLASS * 4);
    for (let i = 0; i < n; i++) this.prevP[i] = this.P[i * 4]!;
    this.prevN = n;
    return changed;
  }

  /** Gives every element its CSS look back (engine off or fallen back). */
  static unmarkAll(): void {
    for (const e of glassEntries()) {
      delete e.el.dataset.glass;
      delete e.el.dataset.glassPoster;
    }
  }
}
