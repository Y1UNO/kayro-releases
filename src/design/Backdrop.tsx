import styles from "./Backdrop.module.css";

/**
 * Base background: theme gradient, three static fog ovals, vignette, film grain.
 * Static on purpose: the animated atmosphere (FxLayer) is step 8. Everything here is gradients
 * (no filter: blur) so it stays cheap on a full-screen surface.
 */
export function Backdrop() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.fog}>
        <div className={`${styles.oval} ${styles.a}`} />
        <div className={`${styles.oval} ${styles.b}`} />
        <div className={`${styles.oval} ${styles.c}`} />
      </div>
      <div className={styles.grain} />
      <div className={styles.vignette} />
    </div>
  );
}
