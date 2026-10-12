import { useRef } from "react";
import { useMotionTokens } from "../../design/motion/current";
import { useAmbientLoop } from "../../design/motion/useAmbientLoop";
import { prefersReducedMotion } from "../../fx/motionPref";
import { t } from "../../i18n";
import { useHub } from "../../store";
import styles from "./EmptyState.module.css";

interface Props {
  /** `all` = no app at all, `category` = apps exist, but none in this category. */
  scope: "all" | "category";
  onAdd: () => void;
}

/**
 * Nothing to show (round 4b, R4b-Etats.txt): a few words, and a dotted « Ajouter une app » card
 * with a gradient « + » that floats a little (4 px over 5 s, frame loop at the ambient rate).
 * Still in Éco and with "reduce motion". Never a blank screen.
 */
export function EmptyState({ scope, onAdd }: Props) {
  const key = scope === "all" ? "home.empty.noApps" : "home.empty.noAppsInCategory";
  const card = useRef<HTMLButtonElement>(null);
  const motion = useMotionTokens();
  const eco = useHub((s) => s.settings?.quality === "eco");
  const { emptyFloat, floatPeriod } = motion.states;
  const floats = !eco && !prefersReducedMotion() && motion.levels[1] && emptyFloat > 0;
  useAmbientLoop(floats, (now) => {
    const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * now) / floatPeriod);
    if (card.current) card.current.style.translate = `0 ${(-emptyFloat * k).toFixed(2)}px`;
  });

  return (
    <div className={styles.wrap} role="status">
      <h2 className={styles.title}>{t(`${key}.title`)}</h2>
      <p className={styles.text}>{t(`${key}.text`)}</p>
      <button ref={card} type="button" className={styles.add} onClick={onAdd}>
        <span className={styles.plus} aria-hidden="true" />
        <span className={styles.label}>{t("home.empty.addCard")}</span>
      </button>
    </div>
  );
}
