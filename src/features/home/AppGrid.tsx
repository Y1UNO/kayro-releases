import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "../../fx/motionPref";
import type { AppEntry, AppRunState } from "../../ipc/bindings";
import { t } from "../../i18n";
import { useDa } from "../../design/da";
import { AppCard } from "./AppCard";
import styles from "./AppGrid.module.css";

interface Props {
  apps: readonly AppEntry[];
  focus: number;
  running: Readonly<Record<string, AppRunState>>;
  /** Number of columns, reported so that Up / Down can move by a row. */
  onColumns: (columns: number) => void;
  onFocus: (index: number) => void;
  onLaunch: (app: AppEntry) => void;
}

/**
 * Grid view: every app at once, scrolling vertically (the full list is never cut). Same listbox
 * pattern as the carousel: one tab stop, `aria-activedescendant` follows the selection.
 */
export function AppGrid({ apps, focus, running, onColumns, onFocus, onLaunch }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const listId = useId();
  // Step 19b: when the order changes, each card glides from its old place to the new one (FLIP:
  // places inside the grid, so a scroll in between does not count; transform only).
  const places = useRef(new Map<string, { x: number; y: number }>());
  const active = apps[focus];
  const activeDomId = active ? `${listId}-${active.id}` : undefined;

  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const measure = () => {
      const columns = getComputedStyle(el).gridTemplateColumns.split(" ").length;
      onColumns(Math.max(1, columns));
      // A new width moves the cards without a new order: their places start from here.
      for (const cell of el.querySelectorAll<HTMLElement>(":scope > [data-app-id]")) {
        places.current.set(cell.dataset.appId ?? "", { x: cell.offsetLeft, y: cell.offsetTop });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onColumns]);

  const order = apps.map((a) => a.id).join("|");
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const glide = !prefersReducedMotion();
    for (const cell of el.querySelectorAll<HTMLElement>(":scope > [data-app-id]")) {
      const id = cell.dataset.appId ?? "";
      const now = { x: cell.offsetLeft, y: cell.offsetTop };
      const before = places.current.get(id);
      const dx = before ? before.x - now.x : 0;
      const dy = before ? before.y - now.y : 0;
      if (glide && Math.abs(dx) + Math.abs(dy) > 1) {
        cell.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
          duration: 320,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
      }
      places.current.set(id, now);
    }
  }, [order]);

  // Keep the selected card on screen.
  useEffect(() => {
    if (activeDomId) document.getElementById(activeDomId)?.scrollIntoView({ block: "nearest" });
  }, [activeDomId]);

  const hoverOff = useDa((s) => s.values.cardHover?.style === "none");
  return (
    <div className={styles.scroller}>
      <div
        ref={grid}
        className={styles.grid}
        role="listbox"
        tabIndex={0}
        aria-label={t("home.apps")}
        aria-activedescendant={activeDomId}
        // The cells enter in a cascade (level 2, motion.css).
        data-cascade=""
        // « Survol des cartes : Aucun » (round 5): no lift.
        data-hover-off={hoverOff ? "" : undefined}
      >
        {apps.map((app, i) => (
          <AppCard
            key={app.id}
            app={app}
            mode="grid"
            active={i === focus}
            running={running[app.id]?.running === true}
            domId={`${listId}-${app.id}`}
            onClick={() => {
              onFocus(i);
              onLaunch(app);
            }}
          />
        ))}
      </div>
    </div>
  );
}
