import { APP_VERSION } from "../../app/appName";
import { Button } from "../../design";
import { t } from "../../i18n";
import { errorText } from "../../ipc/errors";
import { hubStore, useHub } from "../../store";
import { ToggleRow } from "../settings/SettingRow";
import styles from "../settings/Settings.module.css";
import { checkForUpdate, openUpdate, useUpdate } from "./updateStore";

/**
 * Réglages › Général › Mises à jour (step 18b): the check at start (the only network of Kayro,
 * allowed or not, explained) and « Rechercher maintenant » with what it found.
 */
export function UpdateRows() {
  const auto = useHub((s) => s.settings?.updateAuto ?? false);
  const status = useUpdate((s) => s.status);
  const info = useUpdate((s) => s.info);
  const error = useUpdate((s) => s.error);

  const line =
    status === "checking"
      ? t("update.checking")
      : status === "upToDate"
        ? t("update.upToDate", { version: APP_VERSION })
        : status === "available" && info
          ? t("update.found", { version: info.version })
          : status === "error" && error
            ? errorText(error)
            : null;

  return (
    <>
      <ToggleRow
        label={t("settings.general.update.auto")}
        help={t("settings.general.update.help")}
        checked={auto}
        onChange={(updateAuto) => void hubStore.getState().setSettings({ updateAuto })}
      />
      <section className={styles.row} data-row="">
        <div className={styles.resetRow}>
          <Button size="sm" disabled={status === "checking"} onClick={() => void checkForUpdate()}>
            {t("settings.general.update.check")}
          </Button>
          {status === "available" && (
            <Button size="sm" variant="primary" onClick={() => openUpdate(true)}>
              {t("update.see")}
            </Button>
          )}
        </div>
        {line && (
          <p className={status === "error" ? styles.warn : styles.help} role="status">
            {line}
          </p>
        )}
      </section>
    </>
  );
}
