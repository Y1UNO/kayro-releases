import { Surface } from "../../design";
import { t, type MessageKey } from "../../i18n";
import type { StepKind } from "./model";
import styles from "./Side.module.css";

const ACTIONS: { kind: StepKind; label: MessageKey; tag?: MessageKey }[] = [
  { kind: "launch", label: "scenes.palette.launch" },
  { kind: "wait", label: "scenes.palette.wait" },
  { kind: "waitReady", label: "scenes.palette.waitReady" },
  { kind: "focus", label: "scenes.palette.focus" },
  { kind: "close", label: "scenes.palette.close", tag: "scenes.palette.withConfirmation" },
];

/** « Ajouter une action »: one button per step kind; the integrations to come are shown greyed. */
export function ActionPalette({ onAdd }: { onAdd: (kind: StepKind) => void }) {
  return (
    <Surface radius="var(--radius-2xl)" className={styles.side}>
      <h2 className={styles.label}>{t("scenes.palette.title")}</h2>
      <ul className={styles.paletteList}>
        {ACTIONS.map((a) => (
          <li key={a.kind}>
            <button type="button" className={styles.action} onClick={() => onAdd(a.kind)}>
              <span>{t(a.label)}</span>
              {a.tag && <span className={styles.tag}>{t(a.tag)}</span>}
            </button>
          </li>
        ))}
        <li>
          <div className={styles.action} data-soon aria-disabled="true">
            <span>{t("scenes.palette.soon")}</span>
            <span className={styles.tag}>{t("scenes.palette.soonTag")}</span>
          </div>
        </li>
      </ul>
    </Surface>
  );
}
