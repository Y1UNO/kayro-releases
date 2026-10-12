import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { useMotionTokens } from "../../design/motion/current";
import { usePresence, type Presence } from "../../design/motion/usePresence";
import { prefersReducedMotion } from "../../fx/motionPref";
import { foldDuration, foldSteps, unrollSteps, type From, type Step } from "./unroll";

interface Refs {
  panel: RefObject<HTMLElement | null>;
  bar: RefObject<HTMLElement | null>;
}

interface Els {
  panel: HTMLElement;
  bar: HTMLElement | null;
  hull: HTMLElement;
  inner: HTMLElement;
  content: HTMLElement;
  halo: HTMLElement | null;
  sheen: HTMLElement | null;
  rows: HTMLElement[];
  chips: HTMLElement[][];
}

function collect(refs: Refs): Els | null {
  const panel = refs.panel.current;
  const q = (s: string) => panel?.querySelector<HTMLElement>(`[data-unroll="${s}"]`) ?? null;
  const hull = q("hull");
  const inner = q("inner");
  const content = q("content");
  if (!panel || !hull || !inner || !content) return null;
  const rows = [...content.querySelectorAll<HTMLElement>("[data-unroll-row]")];
  return {
    panel,
    bar: refs.bar.current,
    hull,
    inner,
    content,
    halo: q("halo"),
    sheen: q("sheen"),
    rows,
    chips: rows.map((r) => [...r.querySelectorAll<HTMLElement>("[data-unroll-chip]")]),
  };
}

function all(els: Els): HTMLElement[] {
  return [
    els.hull,
    els.inner,
    els.content,
    ...(els.halo ? [els.halo] : []),
    ...(els.sheen ? [els.sheen] : []),
    ...els.rows,
    ...els.chips.flat(),
  ];
}

/** Where the boxes are now (mid-animation included), then every running animation stops. */
function settle(els: Els): From {
  const css = (el: HTMLElement) => getComputedStyle(el);
  const from: From = {
    hull: { transform: css(els.hull).transform, opacity: css(els.hull).opacity },
    inner: css(els.inner).transform,
    content: css(els.content).opacity,
    halo: els.halo ? css(els.halo).opacity : undefined,
  };
  for (const el of all(els)) for (const a of el.getAnimations()) a.cancel();
  if (from.hull?.transform === "none") from.hull.transform = "scaleX(1)";
  if (from.inner === "none") from.inner = "translateY(0px) scaleY(1)";
  return from;
}

function play(els: Els, steps: readonly Step[]): void {
  for (const s of steps) {
    const t = s.target;
    const el =
      typeof t === "string"
        ? t === "bar"
          ? els.bar
          : t === "halo"
            ? els.halo
            : t === "sheen"
              ? els.sheen
              : els[t]
        : "row" in t
          ? els.rows[t.row]
          : els.chips[t.chip[0]]?.[t.chip[1]];
    el?.animate(s.keyframes, s.options);
  }
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Opens and folds the widget's panel (round 4b): keeps it mounted while it folds (returns its
 * presence), never animates while the window changes size. Opening from closed: the panel mounts
 * invisible, the window takes its unfolded size (`fitNow`), one frame, then the glass unrolls.
 * Folding: the glass rolls up, then the panel unmounts and the window shrinks (size observer).
 * A click during either one starts the other from where the boxes are. "Reduce motion" or
 * level 2 off: final state at once.
 */
export function useUnroll(
  open: boolean,
  refs: Refs,
  fitNow: () => Promise<void>,
  eco: boolean,
): Presence {
  const t = useMotionTokens();
  const instant = prefersReducedMotion() || !t.levels[1];
  const presence = usePresence(open, instant ? 0 : foldDuration(t));
  const mounted = useRef(false);
  const latest = useRef({ t, eco, instant, fitNow });
  // Runs before the effect below (same commit): it reads the values of this render.
  useLayoutEffect(() => {
    latest.current = { t, eco, instant, fitNow };
  });

  useLayoutEffect(() => {
    const was = mounted.current;
    mounted.current = presence !== null;
    const els = collect(refs);
    if (!els) return;
    const { t, eco, instant, fitNow } = latest.current;
    if (instant) {
      for (const el of all(els)) for (const a of el.getAnimations()) a.cancel();
      return;
    }
    if (presence === "out") {
      play(els, foldSteps(t, eco, settle(els)));
      return;
    }
    if (presence !== "in") return;
    const shape = {
      rows: els.rows.length,
      chips: els.chips.map((c) => c.length),
      eco,
    };
    if (was) {
      // Clicked again while it folded: back from where it is.
      play(els, unrollSteps(t, shape, settle(els)));
      return;
    }
    let live = true;
    els.panel.dataset.phase = "pre";
    void fitNow()
      .then(nextFrame)
      .then(() => {
        if (!live) return;
        delete els.panel.dataset.phase;
        play(els, unrollSteps(t, shape));
      });
    return () => {
      live = false;
      delete els.panel.dataset.phase;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presence]);

  return presence;
}
