import { playSound } from "../../sound/engine";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogCap } from "../../fx/cadenceCap";
import { prefersReducedMotion } from "../../fx/motionPref";
import { Surface } from "../glass/Surface";
import { useMotionTokens } from "../motion/current";
import { durOf } from "../motion/tokens";
import { usePresence } from "../motion/usePresence";
import { CloseIcon } from "../icons";
import { IconButton } from "./IconButton";
import styles from "./Dialog.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Label of the close button. */
  closeLabel?: string;
  /**
   * `wide` = 760 px panel that fills the window height (forms and lists with their own scroll);
   * `settings` = 1040 px, a side column of categories and a scrolling body (round 5).
   */
  size?: "md" | "wide" | "settings";
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: rendered in a portal, focus moves in and is trapped (Tab cycles), Escape closes,
 * the rest of the app is `inert`, and focus returns to the opener on close.
 *
 * Motion (level 2 of the token table, round 4a): appears in "moyen" (scale 0.96 → 1, rises 14 px),
 * closes in 0.7 × that without a cascade. Focus and `inert` are given back at once; the panel only
 * stays on screen (inert to the pointer) for its exit, showing what it showed when it closed.
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
  const motion = useMotionTokens();
  const presence = usePresence(open, durOf(motion, 2, "moyen", prefersReducedMotion(), true));
  // The scene under the scrim needs fewer frames (step 13, CADENCE.underDialog).
  useDialogCap(open);
  // The opener often clears its data on close: the exit shows the last content.
  const [kept, setKept] = useState({ title, children });
  if (open && (kept.title !== title || kept.children !== children)) setKept({ title, children });
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Step 17b: a soft rise when it opens, a fall when it closes (not for a dialog born closed).
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open !== wasOpen.current) playSound(open ? "dialogOpen" : "dialogClose");
    wasOpen.current = open;
  }, [open]);

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

  if (!presence) return null;
  const shown = open ? { title, children } : kept;

  return createPortal(
    <div
      className={styles.scrim}
      data-closing={presence === "out" ? "" : undefined}
      onMouseDown={(e) => {
        if (open && e.target === e.currentTarget) onClose();
      }}
    >
      <Surface
        as="section"
        flat
        radius="var(--radius-panel)"
        className={size === "md" ? styles.panel : `${styles.panel} ${styles[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div ref={panel} tabIndex={-1} className={styles.inner}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {shown.title}
            </h2>
            <IconButton label={closeLabel} size="sm" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </header>
          <div className={styles.body}>{shown.children}</div>
        </div>
      </Surface>
    </div>,
    document.body,
  );
}
