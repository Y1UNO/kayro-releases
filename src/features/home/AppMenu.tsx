import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Surface } from "../../design";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import styles from "./Overlays.module.css";

export interface MenuTarget {
  app: AppEntry;
  x: number;
  y: number;
}

interface Props {
  target: MenuTarget;
  onClose: () => void;
  onEdit: (app: AppEntry) => void;
  onRemove: (app: AppEntry) => void;
  onFavorite: (app: AppEntry) => void;
}

/** Context menu of an app (right click, context-menu key, Shift+F10). */
export function AppMenu({ target, onClose, onEdit, onRemove, onFavorite }: Props) {
  const { app } = target;
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: target.x, y: target.y });

  // Keep the menu inside the window, and put the focus in it.
  useLayoutEffect(() => {
    const el = menu.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(target.x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(target.y, window.innerHeight - r.height - 8)),
    });
    el.querySelector<HTMLElement>("button")?.focus();
  }, [target]);

  // Close on a click elsewhere, a resize, or when the window loses the focus.
  useEffect(() => {
    const close = (e: Event) => {
      if (e.type === "pointerdown" && menu.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);

  function onKeyDown(e: KeyboardEvent) {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("button") ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    }
  }

  const run = (action: (app: AppEntry) => void) => () => {
    onClose();
    action(app);
  };

  return createPortal(
    <div ref={menu} className={styles.menu} style={{ left: pos.x, top: pos.y }}>
      <Surface
        flat
        radius="var(--radius-lg)"
        className={styles.surface}
        role="menu"
        aria-label={t("home.menu.label", { name: app.name })}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button type="button" role="menuitem" className={styles.item} onClick={run(onEdit)}>
          {t("home.menu.edit")}
        </button>
        <button type="button" role="menuitem" className={styles.item} onClick={run(onFavorite)}>
          {app.favorite ? t("home.menu.unfavorite") : t("home.menu.favorite")}
        </button>
        <button type="button" role="menuitem" className={styles.item} onClick={run(onRemove)}>
          {t("home.menu.remove")}
        </button>
      </Surface>
    </div>,
    document.body,
  );
}
