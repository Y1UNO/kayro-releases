import type { ReactNode } from "react";
import styles from "./Screens.module.css";

interface Props {
  eyebrow: string;
  /** The title itself (an `h1`, or the editor's name field). */
  children: ReactNode;
  /** Under the rule (the scene's shortcut). */
  under?: ReactNode;
}

/** The home screen's title signature (eyebrow, serif, A → B rule) at 48 px (round 5). */
export function ScreenTitle({ eyebrow, children, under }: Props) {
  return (
    <div className={styles.titleBlock}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      {children}
      <div className={styles.rule} aria-hidden="true" />
      {under && <div className={styles.under}>{under}</div>}
    </div>
  );
}
