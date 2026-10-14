import { useRef } from "react";
import { useMotionTokens } from "../../../design/motion/current";
import { useAmbientLoop } from "../../../design/motion/useAmbientLoop";
import { isEco } from "../../../design/quality";
import { prefersReducedMotion } from "../../../fx/motionPref";
import { useHub } from "../../../store";
import styles from "./Chain.module.css";

/**
 * Something is loading (a step that runs): a light thread glides along a short track, never a
 * spinning wheel (round 4b, R4b-Etats.txt). Still in Éco and with "reduce motion".
 */
export function GlideThread() {
  const bead = useRef<HTMLSpanElement>(null);
  const t = useMotionTokens();
  const eco = useHub((s) => isEco(s.settings?.quality));
  const moving = !eco && !prefersReducedMotion() && t.levels[1];
  const period = t.dur.long * 2;
  useAmbientLoop(moving, (now) => {
    const k = (now % period) / period;
    if (bead.current) bead.current.style.transform = `translateX(${(k * 2 - 0.5) * 100}%)`;
  });
  return (
    <span className={styles.glide} data-still={!moving || undefined} aria-hidden="true">
      <span ref={bead} className={styles.bead} />
    </span>
  );
}
