import { useMemo } from "react";
import { t } from "../../i18n";
import { errorText } from "../../ipc/errors";
import { Message } from "../home/Message";
import { installUpdate, notePoints, openUpdate, updateStore, useUpdate } from "./updateStore";
import { CapriSheet } from "./CapriSheet";
import styles from "./Update.module.css";

/**
 * Step 18b: « Mise à jour disponible » — the version, its patch notes, then the download (a bar
 * filling) and the restart. Never forced: « Plus tard » closes it. Step 20: in the Capri look
 * (CapriSheet).
 */
export function UpdateDialog() {
  const open = useUpdate((s) => s.open);
  const info = useUpdate((s) => s.info);
  const status = useUpdate((s) => s.status);
  const progress = useUpdate((s) => s.progress);
  const error = useUpdate((s) => s.error);
  const busy = status === "downloading";
  if (!info) return null;
  const footer = busy ? (
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
    </>
  );
  return (
    <CapriSheet
      open={open}
      eyebrow={t("update.title")}
      title={t("update.to", { version: info.version })}
      sub={t("update.since", { version: info.current })}
      points={notePoints(info.notes)}
      primary={t("update.install")}
      onPrimary={() => void installUpdate()}
      secondary={t("update.later")}
      onSecondary={() => openUpdate(false)}
      onClose={() => openUpdate(false)}
      busy={busy}
      footer={footer}
    />
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
