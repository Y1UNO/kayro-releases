import { useMemo } from "react";
import { Button, Dialog } from "../../design";
import { t } from "../../i18n";
import { errorText } from "../../ipc/errors";
import { Message } from "../home/Message";
import { installUpdate, notePoints, openUpdate, updateStore, useUpdate } from "./updateStore";
import styles from "./Update.module.css";

/**
 * Step 18b: « Mise à jour disponible » — the version, its patch notes, then the download (a bar
 * filling in the logo's gradient) and the restart. Never forced: « Plus tard » closes it.
 */
export function UpdateDialog() {
  const open = useUpdate((s) => s.open);
  const info = useUpdate((s) => s.info);
  const status = useUpdate((s) => s.status);
  const progress = useUpdate((s) => s.progress);
  const error = useUpdate((s) => s.error);
  const busy = status === "downloading";
  const points = notePoints(info?.notes);

  return (
    <Dialog
      open={open && info !== null}
      onClose={() => !busy && openUpdate(false)}
      title={t("update.title")}
    >
      {info && (
        <div className={styles.body}>
          <p className={styles.versions}>
            <span>{t("update.from", { version: info.current })}</span>
            <span className={styles.arrow} aria-hidden="true" />
            <span className={styles.next}>{t("update.to", { version: info.version })}</span>
          </p>
          {points.length > 0 && (
            <ul className={styles.notes}>
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {busy ? (
            <div className={styles.progress} role="status">
              <div className={styles.track}>
                <span
                  className={styles.fill}
                  data-unknown={progress === null || undefined}
                  style={{ transform: `scaleX(${progress ?? 0.35})` }}
                />
              </div>
              <p className={styles.help}>{t("update.downloading")}</p>
            </div>
          ) : (
            <>
              <p className={styles.help}>{t("update.restart")}</p>
              {status === "error" && error && (
                <p className={styles.warn} role="alert">
                  {errorText(error)}
                </p>
              )}
              <div className={styles.actions}>
                <Button onClick={() => openUpdate(false)}>{t("update.later")}</Button>
                <Button variant="primary" onClick={() => void installUpdate()}>
                  {t("update.install")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** The check at start found something newer: one short message on the home, « Voir ». */
export function UpdateNotice() {
  const announced = useUpdate((s) => s.announced);
  const content = useMemo(
    () =>
      announced
        ? {
            id: announced,
            text: t("update.notice", { version: announced.version }),
            action: { label: t("update.see"), run: () => openUpdate(true) },
          }
        : null,
    [announced],
  );
  return <Message content={content} onClose={() => updateStore.setState({ announced: null })} />;
}
