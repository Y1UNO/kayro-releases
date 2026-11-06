import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronRightIcon, Surface } from "../../design";
import styles from "./Overlays.module.css";

export interface PopMenuItem {
  id: string;
  label: string;
  /** A choice among several (the display mode): shown checked, announced as a radio item. */
  checked?: boolean;
  /** A thin line before it: the start of another kind of action (19b). */
  separated?: boolean;
  /** Its keyboard shortcut, shown on the right (19b). */
  shortcut?: string;
  /** Step 19c: a small icon on the left; `danger`: an action that removes something. */
  icon?: ReactNode;
  danger?: boolean;
  /** Step 19c: opens a small menu beside it instead of acting (« Déplacer vers › »). */
  submenu?: readonly PopMenuItem[];
  /** Step 19c: small buttons sharing one line (« ← Reculer · Avancer → »); `label` names the line. */
  row?: readonly PopMenuItem[];
  onSelect?: () => void;
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

/** A submenu's width, its gap and a margin (Overlays.module.css `.sub`). */
const SUBMENU_ROOM = 200 + 4 + 8;

/** The buttons of the menu level that holds `el` (not those of a submenu inside it). */
function levelButtons(el: Element | null): HTMLElement[] {
  const level = el?.closest("[role=menu]");
  if (!level) return [];
  return [...level.querySelectorAll<HTMLElement>("button")].filter(
    (b) => b.closest("[role=menu]") === level,
  );
}

/**
 * Small menu (level 1, micro): kept inside the window, focus on the checked item (else the first),
 * arrows move, Escape / Tab close, a click elsewhere, a resize or the window losing the focus close
 * it. Used by the app's context menu and the display mode button (round 5). Step 19c: icons, a row
 * of small buttons, and one level of submenu (pointer over it, → or Entrée opens, ← closes).
 */
export function PopMenu({ x, y, align = "start", label, items, onClose }: Props) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y, flip: false });
  const [open, setOpen] = useState<string | null>(null);
  // Step 19c: the pointer crosses other lines on its way to the submenu: it closes only if the
  // pointer stays away a moment (« Déplacer vers » vanished on the way).
  const closing = useRef(0);
  const hover = (id: string | null) => {
    window.clearTimeout(closing.current);
    if (id) setOpen(id);
    else closing.current = window.setTimeout(() => setOpen(null), 320);
  };
  useEffect(() => () => window.clearTimeout(closing.current), []);

  useLayoutEffect(() => {
    const el = menu.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = align === "end" ? x - r.width : x;
    const at = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
    setPos({
      x: at,
      y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
      // No room on the right for a submenu: it opens on the left, towards the screen.
      flip: at + r.width + SUBMENU_ROOM > window.innerWidth,
    });
    const buttons = levelButtons(el.querySelector("[role=menu]"));
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

  // A submenu that opens takes the focus on its first item.
  useEffect(() => {
    if (!open) return;
    const sub = menu.current?.querySelector<HTMLElement>(`[data-submenu="${open}"]`);
    // Past the bottom of the window: it rises until it fits.
    if (sub) {
      const over = sub.getBoundingClientRect().bottom - (window.innerHeight - 8);
      if (over > 0) sub.style.transform = `translateY(${-Math.ceil(over)}px)`;
    }
    levelButtons(sub?.querySelector("button") ?? null)[0]?.focus();
  }, [open]);

  function onKeyDown(e: KeyboardEvent) {
    const active = document.activeElement as HTMLElement | null;
    const buttons = levelButtons(active);
    const at = buttons.indexOf(active as HTMLElement);
    const inSub = active?.closest("[data-submenu]");
    if (e.key === "Escape" && inSub) {
      e.preventDefault();
      e.stopPropagation();
      const parent = inSub.getAttribute("data-submenu");
      setOpen(null);
      menu.current?.querySelector<HTMLElement>(`[data-opens="${parent}"]`)?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const step = e.key === "ArrowDown" ? 1 : -1;
      buttons[(at + step + buttons.length) % buttons.length]?.focus();
    } else if (e.key === "ArrowRight" && active?.dataset.opens) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(active.dataset.opens);
    } else if (e.key === "ArrowLeft" && inSub) {
      e.preventDefault();
      e.stopPropagation();
      const parent = inSub.getAttribute("data-submenu");
      setOpen(null);
      menu.current?.querySelector<HTMLElement>(`[data-opens="${parent}"]`)?.focus();
    }
  }

  const act = (item: PopMenuItem) => {
    onClose();
    item.onSelect?.();
  };

  /** `inSub`: a line of a submenu (the submenu's own surface keeps it open). */
  const button = (item: PopMenuItem, inSub = false) => (
    <button
      key={item.id}
      type="button"
      role={item.checked === undefined ? "menuitem" : "menuitemradio"}
      aria-checked={item.checked}
      aria-haspopup={item.submenu ? "menu" : undefined}
      aria-expanded={item.submenu ? open === item.id : undefined}
      className={styles.item}
      data-separated={item.separated || undefined}
      data-danger={item.danger || undefined}
      data-opens={item.submenu ? item.id : undefined}
      onPointerEnter={() => {
        if (item.submenu) hover(item.id);
        else if (!inSub) hover(null);
      }}
      onClick={() => (item.submenu ? setOpen(item.id) : act(item))}
    >
      {item.icon && <span className={styles.itemIcon}>{item.icon}</span>}
      <span className={styles.itemLabel}>{item.label}</span>
      {item.shortcut && <kbd className={styles.shortcut}>{item.shortcut}</kbd>}
      {item.checked && <CheckIcon size={16} className={styles.check} />}
      {item.submenu && <ChevronRightIcon size={15} className={styles.more} />}
    </button>
  );

  return createPortal(
    <div
      ref={menu}
      className={styles.menu}
      data-flip={pos.flip || undefined}
      style={{ left: pos.x, top: pos.y }}
    >
      <Surface
        flat
        radius="var(--radius-panel)"
        className={styles.surface}
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item) =>
          item.row ? (
            <div
              key={item.id}
              className={styles.row}
              data-separated={item.separated || undefined}
              role="group"
              aria-label={item.label}
              onPointerEnter={() => hover(null)}
            >
              {item.row.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="menuitem"
                  className={styles.rowButton}
                  aria-label={b.shortcut ? `${b.label} (${b.shortcut})` : b.label}
                  title={b.shortcut ? `${b.label} · ${b.shortcut}` : b.label}
                  onClick={() => act(b)}
                >
                  {b.icon}
                  <span>{b.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div key={item.id} className={styles.slotItem}>
              {button(item)}
              {item.submenu && open === item.id && (
                <Surface
                  flat
                  radius="var(--radius-panel)"
                  className={`${styles.surface} ${styles.sub}`}
                  role="menu"
                  aria-label={item.label}
                  data-submenu={item.id}
                  onPointerEnter={() => hover(item.id)}
                >
                  {item.submenu.map((sub) => button(sub, true))}
                </Surface>
              )}
            </div>
          ),
        )}
      </Surface>
    </div>,
    document.body,
  );
}
