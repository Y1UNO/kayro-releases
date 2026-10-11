import { useLayoutEffect, useRef } from "react";
import { frameLoop } from "../../fx/loop";
import { prefersReducedMotion } from "../../fx/motionPref";
import { useGlass } from "./glassRegistry";
import { pillAt, type PillBox } from "./pillMotion";
import styles from "./SelectionPill.module.css";

interface Props {
  /** The current choice: the pill moves when it changes. */
  value: string;
  /** Selector of the selected item among the pill's siblings. */
  selector: string;
}

const num = (s: string, d: number) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : d;
};

/**
 * Selection pill drawn by the liquid glass engine (kind `pill`) under the selected item of a tab
 * list or a segmented control. Without the engine it stays invisible and the item keeps its CSS
 * "selected" fill. It writes the hole of its frosted hosts (`data-hole-host` ancestors: their CSS
 * backing is cut where the pill is, so the pill shows the sharp refraction below; see the CSS of
 * Surface and SegmentedControl).
 */
export function SelectionPill({ value, selector }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const box = useRef<PillBox | null>(null);
  useGlass(ref, "pill");

  useLayoutEffect(() => {
    const pill = ref.current;
    const parent = pill?.parentElement;
    if (!pill || !parent) return;
    const hosts: HTMLElement[] = [];
    for (let a = parent as HTMLElement | null; a; a = a.parentElement) {
      if (a.dataset.holeHost !== undefined) hosts.push(a);
    }
    const place = (b: PillBox) => {
      box.current = b;
      pill.style.width = `${b.w}px`;
      pill.style.height = `${b.h}px`;
      pill.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
      const r = pill.getBoundingClientRect();
      for (const h of hosts) {
        const hr = h.getBoundingClientRect();
        h.style.setProperty("--hole-x", `${r.left - hr.left}px`);
        h.style.setProperty("--hole-y", `${r.top - hr.top}px`);
        h.style.setProperty("--hole-w", `${r.width}px`);
        h.style.setProperty("--hole-h", `${r.height}px`);
      }
    };
    const target = (): PillBox | null => {
      const el = parent.querySelector<HTMLElement>(selector);
      if (!el) return null;
      return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    };

    const to = target();
    let stop: (() => void) | null = null;
    if (to) {
      const from = box.current;
      if (!from || prefersReducedMotion()) place(to);
      else {
        const css = getComputedStyle(pill);
        const duration = num(css.getPropertyValue("--da-pill-dur"), 420);
        const stretch = num(css.getPropertyValue("--da-pill-stretch"), 0.35);
        const bounce = num(css.getPropertyValue("--da-pill-bounce"), 0);
        let elapsed = 0;
        stop = frameLoop().subscribe((dt) => {
          elapsed += dt;
          const p = Math.min(1, elapsed / duration);
          place(pillAt(from, to, p, stretch, bounce));
          if (p >= 1) {
            stop?.();
            stop = null;
          }
        });
      }
    }
    // The items change size (fonts loaded, window resized): snap to the selected one.
    const snap = () => {
      if (stop) return;
      const t = target();
      if (t) place(t);
    };
    const ro = new ResizeObserver(snap);
    ro.observe(parent);
    window.addEventListener("resize", snap);
    return () => {
      stop?.();
      ro.disconnect();
      window.removeEventListener("resize", snap);
    };
  }, [value, selector]);

  return <span ref={ref} className={styles.pill} aria-hidden="true" />;
}
