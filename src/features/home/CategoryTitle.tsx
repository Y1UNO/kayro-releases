import { AnimatePresence, m } from "motion/react";
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
      <div className={styles.underline} aria-hidden="true" />
    </div>
  );
}
