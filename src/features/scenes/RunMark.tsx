import { CheckIcon, CloseIcon } from "../../design";
import { t } from "../../i18n";
import type { StepView } from "../../store";
import { REASON_LABELS } from "./describe";
import styles from "./Steps.module.css";

/** State of one step during a run: a mark, and for failed or skipped steps the reason in words. */
export function RunMark({ view }: { view: StepView | undefined }) {
  if (!view || view.state === "pending") return null;
  const reason = view.reason ? t(REASON_LABELS[view.reason]) : null;
  const label = t(`scenes.state.${view.state}`);
  return (
    <span className={styles.mark} data-state={view.state} title={reason ?? label}>
      {view.state === "running" && <span className={styles.spinner} aria-hidden="true" />}
      {view.state === "ok" && <CheckIcon size={14} />}
      {view.state === "failed" && <CloseIcon size={14} />}
      {view.state === "skipped" && <span className={styles.dash} aria-hidden="true" />}
      <span className={styles.markText}>{reason ? `${label} · ${reason}` : label}</span>
    </span>
  );
}
