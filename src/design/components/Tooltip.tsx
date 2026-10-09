import { cloneElement, useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";
import styles from "./Tooltip.module.css";

interface Props {
  content: string;
  /** The single focusable child the tooltip describes. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  placement?: "top" | "bottom";
  /** Hover delay in ms (focus shows it immediately). */
  delay?: number;
}

/** Shows on hover (after a delay) and on keyboard focus; Escape hides it. Timer cleared on leave/unmount. */
export function Tooltip({ content, children, placement = "top", delay = 350 }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const show = useCallback(
    (wait: number) => {
      clear();
      if (wait <= 0) setOpen(true);
      else timer.current = window.setTimeout(() => setOpen(true), wait);
    },
    [clear],
  );

  const hide = useCallback(() => {
    clear();
    setOpen(false);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return (
    <span
      className={styles.wrap}
      onMouseEnter={() => show(delay)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          hide();
        }
      }}
    >
      {cloneElement(children, open ? { "aria-describedby": id } : {})}
      {open ? (
        <span id={id} role="tooltip" className={`${styles.bubble} ${styles[placement]}`}>
          {content}
        </span>
      ) : null}
    </span>
  );
}
