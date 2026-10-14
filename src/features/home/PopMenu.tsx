import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, Surface } from "../../design";
import styles from "./Overlays.module.css";

export interface PopMenuItem {
  id: string;
  label: string;
  /** A choice among several (the display mode): shown checked, announced as a radio item. */
  checked?: boolean;
  onSelect: () => void;
}

interface Props {
  /** Where the menu opens (viewport px); `align: "end"` puts its right edge there. */
  x: number;
  y: number;
  align?: "start" | "end";
  label: string;
  items: readonly PopMenuItem[];
  onClose: () => void;
}

/**
 * Small menu (level 1, micro): kept inside the window, focus on the checked item (else the first),
 * arrows move, Escape / Tab close, a click elsewhere, a resize or the window losing the focus close
 * it. Used by the app's context menu and the display mode button (round 5).
 */
export function PopMenu({ x, y, align = "start", label, items, onClose }: Props) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = menu.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = align === "end" ? x - r.width : x;
    setPos({
      x: Math.max(8, Math.min(left, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    });
    const buttons = [...el.querySelectorAll<HTMLElement>("button")];
    (buttons.find((b) => b.getAttribute("aria-checked") === "true") ?? buttons[0])?.focus();
  }, [x, y, align]);

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
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLElement>("button") ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const step = e.key === "ArrowDown" ? 1 : -1;
      buttons[(at + step + buttons.length) % buttons.length]?.focus();
    }
  }

  return createPortal(
    <div ref={menu} className={styles.menu} style={{ left: pos.x, top: pos.y }}>
      <Surface
        flat
        radius="var(--radius-panel)"
        className={styles.surface}
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role={item.checked === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={item.checked}
            className={styles.item}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            <span>{item.label}</span>
            {item.checked && <CheckIcon size={16} className={styles.check} />}
          </button>
        ))}
      </Surface>
    </div>,
    document.body,
  );
}
