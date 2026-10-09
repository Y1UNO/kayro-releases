import type { ReactNode } from "react";
import styles from "./Backdrop.module.css";

/**
 * Fixed background layers: theme gradient, then `children` (the animated atmosphere, see
 * `src/fx/`), then film grain and vignette on top. Gradients only (no filter: blur), so it stays
 * cheap on a full-screen surface.
 */
export function Backdrop({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.root} aria-hidden="true">
      {children}
      <div className={styles.grain} />
      <div className={styles.vignette} />
    </div>
  );
}
