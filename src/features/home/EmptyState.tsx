import { Button, Surface } from "../../design";
import { t } from "../../i18n";
import styles from "./EmptyState.module.css";

interface Props {
  /** `all` = no app at all, `category` = apps exist, but none in this category. */
  scope: "all" | "category";
  onAdd: () => void;
}

export function EmptyState({ scope, onAdd }: Props) {
  const key = scope === "all" ? "home.empty.noApps" : "home.empty.noAppsInCategory";
  return (
    <div className={styles.wrap}>
      <Surface radius="var(--radius-3xl)" className={styles.card} role="status">
        <h2 className={styles.title}>{t(`${key}.title`)}</h2>
        <p className={styles.text}>{t(`${key}.text`)}</p>
        <Button variant="primary" onClick={onAdd}>
          {t("home.empty.add")}
        </Button>
      </Surface>
    </div>
  );
}
