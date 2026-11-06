import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { TetherFrom } from "./TetherGhost";

/** How far a row follows the pointer while still held in « Mes apps » (px, at most). */
const STRETCH = 70;
/** Distance at which the row has given half of its stretch (px). */
const STRETCH_HALF = 120;

/** A pull with resistance: follows at first, then less and less, never more than `STRETCH`. */
export function stretch(d: number): number {
  return (Math.sign(d) * STRETCH * Math.abs(d)) / (Math.abs(d) + STRETCH_HALF);
}

interface Pull {
  start: { x: number; y: number };
  /** The row taken, and where it was when it came out (the frame starts there). */
  row: HTMLElement | null;
  from: TetherFrom;
  out: boolean;
}

const rectOf = (el: Element): TetherFrom => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/**
 * Step 19c, taking an app out of « Mes apps »: first the row itself is pulled, stretching with
 * resistance while the pointer stays over the list; once the pointer leaves the list, the row
 * comes out and turns into the small frame on its thread (TetherGhost). Released inside the
 * list, it springs back to its place.
 */
export function usePullOut(pool: RefObject<HTMLElement | null>) {
  const [pull, setPull] = useState<Pull | null>(null);
  const live = useRef<Pull | null>(null);

  /** A press on a row of « Mes apps » (`out`: a row of the scene, already free). */
  const take = useCallback((e: { clientX: number; clientY: number; currentTarget: Element }, out = false) => {
    const row = e.currentTarget.closest<HTMLElement>("li");
    const next = {
      start: { x: e.clientX, y: e.clientY },
      row,
      from: rectOf(row ?? e.currentTarget),
      out,
    };
    live.current = next;
    setPull(next);
  }, []);

  /** The pointer moved: out of the list, the row comes out. */
  const move = useCallback(
    (x: number, y: number) => {
      const p = live.current;
      // The whole « Mes apps » panel (the list's box), not only its rows.
      const panel = pool.current?.parentElement ?? pool.current;
      const box = panel?.getBoundingClientRect();
      if (!p || p.out || !box) return;
      const inside = x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      if (inside) return;
      const next = { ...p, out: true, from: p.row ? rectOf(p.row) : p.from };
      live.current = next;
      setPull(next);
    },
    [pool],
  );

  const end = useCallback(() => {
    live.current = null;
    setPull(null);
  }, []);

  /** The row's stretch towards the pointer while it is still held in the list. */
  const offset = (x: number, y: number) =>
    pull && !pull.out ? { x: stretch(x - pull.start.x), y: stretch(y - pull.start.y) } : null;

  return { pull, take, move, end, offset };
}
