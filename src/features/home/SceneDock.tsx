import { Button, IconButton, MicIcon, Surface } from "../../design";
import { t } from "../../i18n";
import styles from "./SceneDock.module.css";

/**
 * Scene dock: place and style are final, the content is a placeholder until step 11
 * (scene editor). The buttons are disabled, so nothing pretends to work.
 */
export function SceneDock() {
  return (
    <Surface
      as="nav"
      radius="var(--radius-4xl)"
      className={styles.dock}
      aria-label={t("home.dock.label")}
    >
      <Button variant="primary" disabled className={styles.item}>
        {t("home.dock.sample1")}
      </Button>
      <Button disabled className={styles.item}>
        {t("home.dock.sample2")}
      </Button>
      <Button disabled className={styles.item}>
        {t("home.dock.sample3")}
      </Button>
      <span className={styles.separator} aria-hidden="true" />
      <IconButton label={t("home.voice")} disabled className={styles.item}>
        <MicIcon size={20} />
      </IconButton>
    </Surface>
  );
}
