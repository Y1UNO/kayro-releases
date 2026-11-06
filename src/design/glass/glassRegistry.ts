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
  return () => {
    const i = entries.indexOf(entry);
    if (i >= 0) entries.splice(i, 1);
    delete el.dataset.glassKind;
    delete el.dataset.glass;
  };
}

export function glassEntries(): readonly GlassEntry[] {
  return entries;
}

export function markGlassDirty(): void {
  for (const e of entries) e.dirty = true;
}

/** One element's static info must be read again (it now shows something else). */
export function markGlassDirtyFor(el: HTMLElement): void {
  for (const e of entries) if (e.el === el) e.dirty = true;
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

/** A floating card (round 5): its rocking (rad) and its height for the ground shadow (0–1). */
export interface GlassFloat {
  rot: number;
  elev: number;
}

const floats = new WeakMap<Element, GlassFloat>();

/** A tilted card (review 2026-10-29): CSS `rotateX(x) rotateY(y)` (rad), perspective (px). */
export interface GlassTilt {
  x: number;
  y: number;
  persp: number;
}

const tilts = new WeakMap<Element, GlassTilt>();

/** The carousel's cards tilt towards the pointer: the engine draws their glass tilted too. */
export function setGlassTilt(el: Element, t: GlassTilt | null): void {
  if (t && (t.x !== 0 || t.y !== 0)) tilts.set(el, t);
  else tilts.delete(el);
}

export function glassTiltOf(el: Element): GlassTilt | undefined {
  return tilts.get(el);
}

/**
 * Width and height of the screen box of a w × h card tilted by `t`, over w and h: a tilted
 * card's bounding box is a little larger than the card (its near side grows).
 */
export function tiltBoxGrowth(t: GlassTilt, w: number, h: number): [number, number] {
  const [ca, sa, cb, sb] = [Math.cos(t.x), Math.sin(t.x), Math.cos(t.y), Math.sin(t.y)];
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [x, y] of [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ] as const) {
    // M = Rx(a) · Ry(b), then the perspective divide.
    const X = cb * x;
    const Y = sa * sb * x + ca * y;
    const Z = -ca * sb * x + sa * y;
    const k = t.persp > 0 ? t.persp / (t.persp - Z) : 1;
    x0 = Math.min(x0, X * k);
    x1 = Math.max(x1, X * k);
    y0 = Math.min(y0, Y * k);
    y1 = Math.max(y1, Y * k);
  }
  return [(x1 - x0) / w, (y1 - y0) / h];
}

/**
 * The carousel's floating cards are measured, not posed: the engine reads here how much the card
 * is rocked (to measure its true size inside its bounding box) and how high it floats.
 */
export function setGlassFloat(el: Element, f: GlassFloat | null): void {
  if (f) floats.set(el, f);
  else floats.delete(el);
}

export function glassFloatOf(el: Element): GlassFloat | undefined {
  return floats.get(el);
}
