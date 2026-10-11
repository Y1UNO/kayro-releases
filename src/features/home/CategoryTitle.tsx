import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";
import { useDa } from "../../design/da";
import { EASE, SPRING } from "../../design";
import { t } from "../../i18n";
import { CATEGORY_LABELS, type CategoryId } from "./categories";
import styles from "./CategoryTitle.module.css";

interface Props {
  category: CategoryId;
  /** Smaller title (grid view leaves more room to the cards). */
  compact: boolean;
}

/** "CATEGORY" label and the big serif title. The title slides in on a spring, the old one fades out. */
export function CategoryTitle({ category, compact }: Props) {
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
            exit={{ opacity: 0, y: -16, transition: { duration: 0.2, ease: EASE } }}
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

const SWEEP_MS = 1100;

/**
 * A light gliding along the rule under the title: once when the category changes, then every
 * `underlineShine` seconds. Not a CSS infinite animation (it would ask for a frame at every
 * refresh, see Shine.tsx): a one-shot Web Animation and one timer. None with reduced motion.
 */
function UnderlineShine({ category }: { category: CategoryId }) {
  const band = useRef<HTMLSpanElement>(null);
  const every = useDa((s) => {
    const v = s.values.categoryTitle;
    return v?.on !== false && v?.underline !== false && typeof v?.underlineShine === "number"
      ? v.underlineShine
      : 0;
  });
  useEffect(() => {
    const el = band.current;
    if (!el || every <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const play = () => {
      // Never more than one (a hidden window may not advance them: they must not pile up).
      for (const x of el.getAnimations()) x.cancel();
      el.animate([{ transform: "translateX(-110%)" }, { transform: "translateX(400%)" }], {
        duration: SWEEP_MS,
        easing: "cubic-bezier(.4,0,.2,1)",
      });
      timer = window.setTimeout(play, every * 1000);
    };
    timer = window.setTimeout(play, 450);
    return () => {
      window.clearTimeout(timer);
      for (const a of el.getAnimations()) a.cancel();
    };
  }, [every, category]);
  return (
    <span className={styles.underlineClip}>
      <span ref={band} className={styles.underlineShine} />
    </span>
  );
}
