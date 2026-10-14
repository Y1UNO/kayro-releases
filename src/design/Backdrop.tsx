import type { CSSProperties, ReactNode } from "react";
import styles from "./Backdrop.module.css";

/**
 * Fixed background layers: theme gradient, then `children` (the animated atmosphere, see
 * `src/fx/`), then film grain and vignette on top. Gradients only (no filter: blur), so it stays
 * cheap on a full-screen surface.
 */
export function Backdrop({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div className={styles.root} style={style} aria-hidden="true">
      {children}
      <div className={styles.grain} />
      <div className={styles.vignette} />
    </div>
  );
}
