import type { HTMLAttributes } from "react";
import styles from "./Pill.module.css";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  /** `soft` = veil, `accent` = accent fill, `key` = keyboard shortcut (e.g. "Ctrl K"). */
  tone?: "soft" | "accent" | "key";
}

export function Pill({ tone = "soft", className, ...rest }: Props) {
  return (
    <span {...rest} className={[styles.pill, styles[tone], className].filter(Boolean).join(" ")} />
  );
}
