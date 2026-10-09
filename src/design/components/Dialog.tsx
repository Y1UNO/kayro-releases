import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Surface } from "../glass/Surface";
import { CloseIcon } from "../icons";
import { IconButton } from "./IconButton";
import styles from "./Dialog.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Label of the close button. */
  closeLabel?: string;
  /** `wide` = 760 px panel that fills the window height (forms and lists with their own scroll). */
  size?: "md" | "wide";
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: rendered in a portal, focus moves in and is trapped (Tab cycles), Escape closes,
 * the rest of the app is `inert`, and focus returns to the opener on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  closeLabel = "Fermer",
  size = "md",
  children,
}: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const appRoot = document.getElementById("root");
    appRoot?.setAttribute("inert", "");

    const focusables = () =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null,
      );
    // First control after the close button if there is one, else the close button itself.
    const items = focusables();
    (items[1] ?? items[0] ?? panel.current)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.current?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      appRoot?.removeAttribute("inert");
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Surface
        as="section"
        radius="var(--radius-3xl)"
        className={size === "wide" ? `${styles.panel} ${styles.wide}` : styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div ref={panel} tabIndex={-1} className={styles.inner}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <IconButton label={closeLabel} size="sm" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </header>
          <div className={styles.body}>{children}</div>
        </div>
      </Surface>
    </div>,
    document.body,
  );
}
