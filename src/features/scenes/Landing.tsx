import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { prefersReducedMotion } from "../../fx/motionPref";
import type { AppEntry } from "../../ipc/bindings";
import { useAppIcon } from "../home/useAppIcon";
import type { TetherFrom } from "./TetherGhost";
import styles from "./Tether.module.css";

interface Props {
  app: AppEntry;
  /** Where the small frame was when it was dropped. */
  from: TetherFrom;
  /** The scene's list: the app's new row is in it (`data-row-key`). */
  list: RefObject<HTMLElement | null>;
  onDone: () => void;
}

/** The frame grows into its row in this time (ms). */
const LAND_MS = 480;

/**
 * Step 19c, an app dropped in the scene: the small frame does not vanish, it travels to the
 * place it was dropped at and changes shape into the scene's row — wider, a little past, then
 * settling — and the real row takes over under it. Reduced motion: the row at once.
 */
export function Landing({ app, from, list, onDone }: Props) {
  const icon = useAppIcon(app);
  const ghost = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(app.id)}"]`);
    const el = ghost.current;
    if (!row || !el || prefersReducedMotion()) {
      onDone();
      return;
    }
    const to = row.getBoundingClientRect();
    row.style.visibility = "hidden";
    const box = (r: { left: number; top: number; width: number; height: number }, radius: number) => ({
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      borderRadius: `${radius}px`,
    });
    const past = { left: to.left - 6, top: to.top - 3, width: to.width + 12, height: to.height + 6 };
    const grow = el.animate(
      [
        { ...box(from, 16), offset: 0 },
        { ...box(past, 15), offset: 0.62 },
        { ...box(to, 14), offset: 1 },
      ],
      { duration: LAND_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );
    let live = true;
    void grow.finished.then(() => {
      if (!live) return;
      row.style.visibility = "";
      row.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
      void el
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" })
        .finished.then(() => live && onDone());
    });
    return () => {
      live = false;
      row.style.visibility = "";
    };
    // Once: the landing plays from the frame's place to the new row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className={styles.layer} aria-hidden="true">
      <div
        ref={ghost}
        className={`${styles.frame} ${styles.landing}`}
        style={{ left: from.left, top: from.top, width: from.width, height: from.height }}
      >
        <span className={styles.icon}>
          {icon ? <img src={icon} alt={""} draggable={false} /> : app.name.charAt(0).toUpperCase()}
        </span>
        <span className={styles.name}>{app.name}</span>
      </div>
    </div>,
    document.body,
  );
}
