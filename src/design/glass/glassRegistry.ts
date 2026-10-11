import { useLayoutEffect, type RefObject } from "react";
import type { GLASS_KIND_ELEMENT } from "../da/catalogueGlass";

/**
 * Elements drawn as liquid glass by the WebGL2 engine (src/fx/gpu, step 12b round 2). A screen
 * only declares "this element is glass of kind X" (`useGlass`, or `glassKind` on <Surface>); the
 * engine reads the list, measures each element in the DOM at every frame it draws (no React
 * re-render) and marks the ones it really draws with `data-glass="gpu"` (their CSS look is then
 * removed). Unmarked = the CSS look stays: global or per-kind fallback, engine off.
 */
export type GlassKind = keyof typeof GLASS_KIND_ELEMENT;

export interface GlassEntry {
  readonly el: HTMLElement;
  readonly kind: GlassKind;
  /** Static info below must be read again (registration, resize, theme or art direction change). */
  dirty: boolean;
  /** Live computed styles of the element and its ancestors (opacity of the whole chain). */
  chain: CSSStyleDeclaration[];
  /** Nearest ancestor that clips its content (scroll container), or null. */
  clip: HTMLElement | null;
  /** 1 = inside another glass element (drawn above it, never merged with it). */
  depth: 0 | 1;
  /** Corner radius as written in CSS: px, or a negative fraction of the short side for "%". */
  radius: number;
  /** Tint colour, 0–1. */
  tint: [number, number, number];
}

/** The shader draws at most this many glass elements (the rest keep their CSS look). */
export const MAX_GLASS = 24;

const entries: GlassEntry[] = [];
let version = 0;

export function registerGlass(el: HTMLElement, kind: GlassKind): () => void {
  const entry: GlassEntry = {
    el,
    kind,
    dirty: true,
    chain: [],
    clip: null,
    depth: 0,
    radius: 0,
    tint: [0, 0, 0],
  };
  el.dataset.glassKind = kind;
  entries.push(entry);
  version++;
  return () => {
    const i = entries.indexOf(entry);
    if (i >= 0) entries.splice(i, 1);
    delete el.dataset.glassKind;
    delete el.dataset.glass;
    version++;
  };
}

export function glassEntries(): readonly GlassEntry[] {
  return entries;
}

/** Changes whenever an element registers or leaves. */
export function glassVersion(): number {
  return version;
}

export function markGlassDirty(): void {
  for (const e of entries) e.dirty = true;
}

/** Declares `ref`'s element as glass of `kind` (`undefined` = not glass). */
export function useGlass(ref: RefObject<HTMLElement | null>, kind: GlassKind | undefined): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !kind) return;
    return registerGlass(el, kind);
  }, [ref, kind]);
}

// ---- Pure helpers (tested) ----

/** CSS radius → px, or −fraction of the short side for a percentage. */
export function parseRadius(raw: string): number {
  const v = parseFloat(raw);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return raw.trim().endsWith("%") ? -v / 100 : v;
}

/** Radius in viewport px for a box of half-size hw × hh drawn at `scale` (pills stay pills). */
export function radiusPx(radius: number, hw: number, hh: number, scale: number): number {
  const short = Math.min(hw, hh);
  const r = radius < 0 ? -radius * 2 * short : radius * scale;
  return Math.max(0, Math.min(r, short));
}

/** Product of the opacities of a style chain (`visibility: hidden` on the element = 0). */
export function chainOpacity(chain: readonly Pick<CSSStyleDeclaration, "opacity">[]): number {
  let a = 1;
  for (const cs of chain) {
    const o = parseFloat(cs.opacity);
    if (Number.isFinite(o)) a *= o;
    if (a <= 0.001) return 0;
  }
  return a;
}
