import { createPortal } from "react-dom";
import { Surface } from "../../design";
import styles from "./Overlays.module.css";

/** The name of the card being dragged, following the pointer (it never intercepts it). */
export function DragGhost({ name, x, y }: { name: string; x: number; y: number }) {
  return createPortal(
    <div className={styles.ghost} style={{ transform: `translate3d(${x + 14}px, ${y + 14}px, 0)` }}>
      {name}
    </div>,
    document.body,
  );
}

/** A short confirmation ("3 apps added…"), announced politely to screen readers. */
export function Notice({ text }: { text: string }) {
  return (
    <Surface flat radius="var(--radius-xl)" className={styles.notice} role="status">
      {text}
    </Surface>
  );
}
