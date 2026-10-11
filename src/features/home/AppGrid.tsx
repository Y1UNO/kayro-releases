import { useEffect, useId, useRef } from "react";
import type { AppEntry, AppRunState } from "../../ipc/bindings";
import { targetOf, useFxTarget } from "../../fx";
import { t } from "../../i18n";
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
  const active = apps[focus];
  const activeDomId = active ? `${listId}-${active.id}` : undefined;

  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const measure = () => {
      const columns = getComputedStyle(el).gridTemplateColumns.split(" ").length;
      onColumns(Math.max(1, columns));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onColumns]);

  // Keep the selected card on screen.
  useEffect(() => {
    if (activeDomId) document.getElementById(activeDomId)?.scrollIntoView({ block: "nearest" });
  }, [activeDomId]);

  // The light glides to the selected cell (declared after the scroll: measured once it is done).
  useFxTarget(
    () => (activeDomId ? targetOf(document.getElementById(activeDomId)) : null),
    [activeDomId],
  );

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
