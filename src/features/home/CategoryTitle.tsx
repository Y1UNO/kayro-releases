import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";
import { useWindowVisible } from "../../app/windowVisible";
import { useDa } from "../../design/da";
import { SPRING } from "../../design";
import { useMotionTokens } from "../../design/motion/current";
import { fmTransition } from "../../design/motion/tokens";
import { useReducedMotion } from "../../fx/useReducedMotion";
import { t } from "../../i18n";
import { CATEGORY_LABELS, type CategoryId } from "./categories";
import styles from "./CategoryTitle.module.css";

interface Props {
  category: CategoryId;
  /** Smaller title (grid view leaves more room to the cards). */
  compact: boolean;
}

/**
 * "CATEGORY" label and the big serif title. The title slides in on a spring (round 3 signature),
 * the old one leaves as a disappearance of the motion table (level 2).
 */
export function CategoryTitle({ category, compact }: Props) {
  const motion = useMotionTokens();
  const reduced = useReducedMotion();
  const exit = fmTransition(motion, 2, "court", "out", reduced, true);
  return (
    <div className={styles.block} data-compact={compact || undefined}>
      <div className={styles.label}>{t("home.categoryLabel")}</div>
      <div className={styles.box}>
        <AnimatePresence initial={false}>
          <m.h1
            key={category}
            className={styles.title}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0, transition: SPRING }}
            exit={{ opacity: 0, y: -16, transition: exit }}
          >
            {t(CATEGORY_LABELS[category])}
          </m.h1>
        </AnimatePresence>
      </div>
      <div className={styles.underline} aria-hidden="true">
        <UnderlineShine category={category} />
      </div>
    </div>
  );
}

/**
 * A light gliding along the rule under the title: once when the category changes, then every
 * `underlineShine` seconds. Not a CSS infinite animation (it would ask for a frame at every
 * refresh, see Shine.tsx): a one-shot Web Animation and one timer, stopped while the window is
 * hidden. None with reduced motion. Timing and curve: the motion table (`titleShine`).
 */
function UnderlineShine({ category }: { category: CategoryId }) {
  const band = useRef<HTMLSpanElement>(null);
  const shown = useWindowVisible();
  const reduced = useReducedMotion();
  const { sweepMs, firstAt, ease } = useMotionTokens().titleShine;
  const every = useDa((s) => {
    const v = s.values.categoryTitle;
    return v?.on !== false && v?.underline !== false && typeof v?.underlineShine === "number"
      ? v.underlineShine
      : 0;
  });
  useEffect(() => {
    const el = band.current;
    if (!el || every <= 0 || reduced || !shown) return;
    let timer = 0;
    const play = () => {
      // Never more than one (a hidden window may not advance them: they must not pile up).
      for (const x of el.getAnimations()) x.cancel();
      el.animate([{ transform: "translateX(-110%)" }, { transform: "translateX(400%)" }], {
        duration: sweepMs,
        easing: ease,
      });
      timer = window.setTimeout(play, every * 1000);
    };
    timer = window.setTimeout(play, firstAt);
    return () => {
      window.clearTimeout(timer);
      for (const a of el.getAnimations()) a.cancel();
    };
  }, [every, category, shown, reduced, sweepMs, firstAt, ease]);
  return (
    <span className={styles.underlineClip}>
      <span ref={band} className={styles.underlineShine} />
    </span>
  );
}
