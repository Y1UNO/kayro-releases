import { useState } from "react";
import { Button, Dialog } from "../../design";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { hubStore } from "../../store";
import { AppArtTiles } from "../gameColors/AppArtTiles";
import { AppColorsChoice } from "../gameColors/AppColorsChoice";
import look from "../gameColors/AppLook.module.css";
import { AppMoodChoice } from "../moods/AppMoodChoice";
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
    <div className={`${styles.body} ${styles.editBody}`}>
      {/* Step 14: the app's images and colours, saved at once. */}
      <section className={look.look} aria-label={t("addApps.look.title")}>
        <div className={look.head}>
          <span className={look.title}>{t("addApps.look.title")}</span>
          <p className={look.help}>{t("addApps.look.help")}</p>
        </div>
        <AppArtTiles app={app} />
        <AppColorsChoice app={app} />
        <AppMoodChoice app={app} />
      </section>
      <ManualForm
        initial={draft}
        lockedTarget={isTargetLocked(app) ? draft.target : null}
        submitLabel={t("addApps.edit.save")}
        extra={<Button onClick={() => setRemoving(true)}>{t("addApps.edit.delete")}</Button>}
        onSubmit={async (values) => {
          // The latest entry: the colours chosen above are saved at once, before this form.
          const latest = hubStore.getState().apps.find((a) => a.id === app.id) ?? app;
          const result = await hubStore.getState().updateApp(applyDraft(latest, values));
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
