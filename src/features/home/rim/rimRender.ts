/**
 * Light threads and sparks on the rim of a card (art direction round 3b, fan hover; round 4a,
 * cards of the carousel): two threads of short strokes running round the rim in opposite
 * directions (theme A → B, `offset-path`), a halo at each head, a few sparks leaving them, and a
 * flash of the whole rim. DOM above the cards (the glass engine draws under the DOM, so where
 * cards overlap it could not show them); transform / opacity / `offset-distance` only.
 */
import { MAX_SPARKS, perimeter, sparksAt, threadHeads } from "../fan/fanFloat";
import styles from "./Rim.module.css";

/** Each thread is drawn as a few short strokes along the rim: its tail bends round the corners. */
export const SEGMENTS = 10;

export interface RimEls {
  /** SEGMENTS strokes of thread A, then SEGMENTS of thread B. */
  threads: readonly HTMLElement[];
  /** Sparks. */
  sparks: readonly HTMLElement[];
  /** Halo at the head of thread A and of thread B. */
  heads: readonly HTMLElement[];
  /** Flash of the whole rim. */
  flash: HTMLElement | null;
}

/** How the threads look (the fan's `categoryHover` settings: hoverConfig in fanFloat.ts). */
export interface RimLook {
  threads: boolean;
  threadLength: number;
  threadWidth: number;
  threadIntensity: number;
  threadGlow: number;
  sparks: number;
  sparkSize: number;
  reduced: boolean;
}

export interface RimBox {
  w: number;
  h: number;
  r: number;
}

const sparkBuf = new Float32Array(MAX_SPARKS * 4);

/** Writes a style only when it changes. */
export function put(el: HTMLElement, prop: "transform" | "opacity" | "zIndex", v: string): void {
  if (el.style[prop] !== v) el.style[prop] = v;
}

/**
 * Draws the rim of a card at `now`: `h` = level 0–1 (nothing below 0.005, or without `look`),
 * `burst` = hover-in flash (0–1), `phaseAt(t)` = phase of the threads (0–1 of a turn) at time t.
 */
export function renderRim(
  el: RimEls,
  box: RimBox,
  h: number,
  look: RimLook | null,
  burst: number,
  phaseAt: (t: number) => number,
  now: number,
): void {
  const shown = h > 0.005 && look !== null;
  const threads = shown && look.threads;
  if (el.flash) put(el.flash, "opacity", Math.min(1, burst * Math.min(1, h) * 1.2).toFixed(3));
  for (const t of el.threads) if (!threads) put(t, "opacity", "0");
  for (const t of el.heads) if (!threads) put(t, "opacity", "0");
  for (const sp of el.sparks) if (!shown) put(sp, "opacity", "0");
  if (!shown) return;
  const P = perimeter(box.w, box.h, box.r);
  if (threads && el.threads.length === 2 * SEGMENTS) {
    const heads = threadHeads(phaseAt(now), P);
    const step = (look.threadLength * P) / SEGMENTS;
    for (let k = 0; k < 2 * SEGMENTS; k++) {
      const b = k >= SEGMENTS; // thread B runs the other way: its tail is ahead in path terms
      const j = k % SEGMENTS;
      const d = heads[b ? 1 : 0]! + (b ? 1 : -1) * (j + 0.5) * step;
      const t = el.threads[k]!;
      t.style.offsetDistance = `${d.toFixed(1)}px`;
      const w = `${(step + 1.5).toFixed(1)}px`;
      if (t.style.width !== w) t.style.width = w;
      const th = `${look.threadWidth}px`;
      if (t.style.height !== th) t.style.height = th;
      const fade = Math.pow(1 - j / SEGMENTS, 1.5);
      put(t, "opacity", Math.min(1, h * look.threadIntensity * fade * (1 + burst)).toFixed(3));
    }
    // Head halos: a soft glow that breathes (1.6 pulses a second; still with reduced motion).
    const pulse = look.reduced ? 1 : 0.7 + 0.3 * Math.sin((now / 1000) * 2 * Math.PI * 1.6);
    el.heads.forEach((hd, b) => {
      hd.style.offsetDistance = `${heads[b]!.toFixed(1)}px`;
      put(hd, "opacity", Math.min(1, h * look.threadGlow * (pulse + burst)).toFixed(3));
    });
  }
  const n = sparksAt(
    now,
    look.sparks,
    Math.min(1, h),
    box,
    phaseAt,
    look.sparkSize,
    sparkBuf,
    burst,
  );
  el.sparks.forEach((sp, j) => {
    if (j >= n) return put(sp, "opacity", "0");
    const o = j * 4;
    const x = sparkBuf[o]!;
    const y = sparkBuf[o + 1]!;
    const k = sparkBuf[o + 2]! / 3; // the span is 6 px wide
    put(
      sp,
      "transform",
      `translate(${(x - 3).toFixed(1)}px, ${(y - 3).toFixed(1)}px) scale(${k.toFixed(3)})`,
    );
    put(sp, "opacity", sparkBuf[o + 3]!.toFixed(3));
  });
}

/** CSS classes of the rim's spans (Rim.module.css), for the components that render them. */
export const rimClass = {
  thread: styles.thread!,
  threadHead: styles.threadHead!,
  spark: styles.spark!,
  flash: styles.flash!,
};

/**
 * The rim's spans built from script, in `parent` (cards of the carousel: one set, moved to the
 * hovered card). Same elements as the fan's JSX (CategoryFan.tsx).
 */
export function createRimEls(parent: HTMLElement, sparks: number): RimEls {
  const span = (cls: string, k?: number) => {
    const s = document.createElement("span");
    s.className = cls;
    s.setAttribute("aria-hidden", "true");
    if (k !== undefined) s.style.setProperty("--k", String(k));
    parent.append(s);
    return s;
  };
  const threads = Array.from({ length: 2 * SEGMENTS }, (_, k) =>
    span(rimClass.thread, (k % SEGMENTS) / SEGMENTS),
  );
  const flash = span(rimClass.flash);
  // Head A says its colour too: on a carousel card the slot's own `--k` (its shade) would leak in.
  const heads = [span(rimClass.threadHead, 0), span(rimClass.threadHead, 1)];
  const n = Math.max(1, sparks);
  const sp = Array.from({ length: sparks }, (_, k) => span(rimClass.spark, k / Math.max(1, n - 1)));
  return { threads, sparks: sp, heads, flash };
}
