import { t } from "../../i18n";
import { HandsSection } from "./HandsSection";
import own from "./Voice.module.css";
import css from "./Assistant.module.css";

/**
 * Réglages › Concept / Fun (2026-11-06, the user's wish): the ways to drive Kayro still on trial,
 * for the fun of it. Today the hands (step 22); later ideas join it as their own group.
 */
export function FunSection() {
  return (
    <>
      <p className={own.intro}>{t("settings.fun.intro")}</p>
      <h3 className={css.groupTitle}>{t("settings.fun.hands")}</h3>
      <HandsSection />
    </>
  );
}
