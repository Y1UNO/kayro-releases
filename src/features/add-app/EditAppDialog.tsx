import { useState } from "react";
import { Button, Dialog } from "../../design";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { artIpc } from "../../ipc/commands";
import { hubStore, imageOf, useArt } from "../../store";
import { applyDraft, entryToDraft, isTargetLocked } from "./draft";
import { ManualForm } from "./ManualForm";
import { refusalOf } from "./refusal";
import styles from "./AddApps.module.css";

interface Props {
  /** The app being edited; null = closed. */
  app: AppEntry | null;
  /** Open straight on the "remove from the app?" question (from the context menu). */
  startWithRemove?: boolean;
  onClose: () => void;
}

/** Edit an app, or remove it from the list. The program itself is never touched. */
export function EditAppDialog({ app, startWithRemove = false, onClose }: Props) {
  return (
    <Dialog
      open={app !== null}
      onClose={onClose}
      size="wide"
      title={t("addApps.edit.title")}
      closeLabel={t("addApps.close")}
    >
      {app && <Editor key={app.id} app={app} startWithRemove={startWithRemove} onClose={onClose} />}
    </Dialog>
  );
}

function Editor({
  app,
  startWithRemove,
  onClose,
}: {
  app: AppEntry;
  startWithRemove: boolean;
  onClose: () => void;
}) {
  const [removing, setRemoving] = useState(startWithRemove);
  // Step 14: a poster the user dropped on the card can be taken back (Steam's comes back).
  const userPoster = useArt((s) => imageOf(s, app.id, "poster")?.origin === "user");
  const draft = entryToDraft(app);

  if (removing) {
    return (
      <div className={styles.body}>
        <div className={styles.centered}>
          <p className={styles.label}>{t("addApps.edit.deleteConfirm", { name: app.name })}</p>
          <p className={styles.hint}>{t("addApps.edit.deleteExplain")}</p>
        </div>
        <div className={styles.confirm}>
          <span />
          <div className={styles.actions}>
            <Button onClick={() => (startWithRemove ? onClose() : setRemoving(false))}>
              {t("addApps.edit.deleteNo")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void hubStore.getState().removeApp(app.id);
                onClose();
              }}
            >
              {t("addApps.edit.deleteYes")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      <p className={styles.hint}>
        {userPoster ? t("addApps.edit.posterMine") : t("addApps.edit.posterHint")}
      </p>
      <ManualForm
        initial={draft}
        lockedTarget={isTargetLocked(app) ? draft.target : null}
        submitLabel={t("addApps.edit.save")}
        extra={
          <>
            {userPoster && (
              <Button onClick={() => void artIpc.clearUser(app.id, "poster")}>
                {t("addApps.edit.posterReset")}
              </Button>
            )}
            <Button onClick={() => setRemoving(true)}>{t("addApps.edit.delete")}</Button>
          </>
        }
        onSubmit={async (values) => {
          const result = await hubStore.getState().updateApp(applyDraft(app, values));
          if (!result.ok) {
            hubStore.getState().clearError();
            return refusalOf(result.error);
          }
          onClose();
          return null;
        }}
      />
    </div>
  );
}
