import { useState } from "react";
import {
  Button,
  ChevronLeftIcon,
  EditIcon,
  IconButton,
  PlayIcon,
  PlusIcon,
  ShareIcon,
  StopIcon,
  Surface,
  TrashIcon,
  UploadIcon,
} from "../../design";
import { t } from "../../i18n";
import type { SceneFile } from "../../ipc/bindings";
import { sceneStore, useHub, useScenes } from "../../store";
import { Notice } from "../home/Overlays";
import { ConfirmDialog } from "./ConfirmDialog";
import { ImportDialog } from "./ImportDialog";
import { slotsOf } from "./model";
import { usePlayScene } from "./usePlayScene";
import styles from "./Editor.module.css";

interface Props {
  onBack: () => void;
  /** null = a new scene. */
  onEdit: (id: string | null) => void;
}

/** All scenes: play, edit, export, delete, import. */
export function ScenesScreen({ onBack, onEdit }: Props) {
  const apps = useHub((s) => s.apps);
  const scenes = useScenes((s) => s.scenes);
  const slots = useScenes((s) => s.slots);
  const run = useScenes((s) => s.run);
  const { request, dialog } = usePlayScene();
  const [deleting, setDeleting] = useState<SceneFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = run !== null && run.status === null;

  function say(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function exportScene(scene: SceneFile) {
    const r = await sceneStore.getState().exportScene(scene.id);
    if (r.ok) say(t("scenes.list.exported", { file: r.value.split(/[\\/]/).pop() ?? r.value }));
  }

  return (
    <main className={styles.screen}>
      <Surface as="header" radius="32px" className={styles.bar}>
        <Button size="sm" onClick={onBack}>
          <ChevronLeftIcon size={16} />
          {t("scenes.list.back")}
        </Button>
        <h1 className={styles.title}>{t("scenes.list.title")}</h1>
        <div className={styles.spacer} />
        <Button onClick={() => setImporting(true)}>
          <UploadIcon size={16} />
          {t("scenes.list.import")}
        </Button>
        <Button variant="primary" onClick={() => onEdit(null)}>
          <PlusIcon size={16} />
          {t("scenes.list.new")}
        </Button>
      </Surface>

      {scenes.length === 0 ? (
        <div className={styles.emptyList}>
          <p className={styles.emptyTitle}>{t("scenes.list.emptyTitle")}</p>
          <p className={styles.muted}>{t("scenes.list.emptyText")}</p>
        </div>
      ) : (
        <ul className={styles.sceneList} aria-label={t("scenes.list.title")}>
          {scenes.map((scene) => {
            const names = slotsOf(scene.steps).map(
              (s) => apps.find((a) => a.id === slots[s])?.name ?? s,
            );
            const playing = busy && run?.sceneId === scene.id;
            return (
              <li key={scene.id}>
                <Surface flat radius="var(--radius-xl)" className={styles.sceneCard}>
                  <div className={styles.sceneText}>
                    <span className={styles.sceneName}>{scene.name}</span>
                    <span className={styles.stepSub}>
                      {t(
                        scene.steps.length === 1 ? "scenes.list.stepOne" : "scenes.list.stepMany",
                        {
                          count: scene.steps.length,
                        },
                      )}
                      {names.length > 0 && ` · ${names.join(", ")}`}
                    </span>
                  </div>
                  {scene.hotkey && <span className={styles.keyPill}>{scene.hotkey}</span>}
                  {playing ? (
                    <IconButton
                      label={t("scenes.list.cancel", { name: scene.name })}
                      onClick={() => void sceneStore.getState().cancel()}
                    >
                      <StopIcon />
                    </IconButton>
                  ) : (
                    <IconButton
                      label={t("scenes.list.play", { name: scene.name })}
                      disabled={busy}
                      onClick={() => request(scene)}
                    >
                      <PlayIcon />
                    </IconButton>
                  )}
                  <IconButton
                    label={t("scenes.list.edit", { name: scene.name })}
                    onClick={() => onEdit(scene.id)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    label={t("scenes.list.export", { name: scene.name })}
                    onClick={() => void exportScene(scene)}
                  >
                    <ShareIcon />
                  </IconButton>
                  <IconButton
                    label={t("scenes.list.delete", { name: scene.name })}
                    onClick={() => setDeleting(scene)}
                  >
                    <TrashIcon />
                  </IconButton>
                </Surface>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t("scenes.list.deleteTitle", { name: deleting?.name ?? "" })}
        confirmLabel={t("scenes.list.deleteYes")}
        cancelLabel={t("scenes.list.deleteNo")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void sceneStore.getState().remove(deleting.id);
          setDeleting(null);
        }}
      >
        <p>{t("scenes.list.deleteText")}</p>
      </ConfirmDialog>
      <ImportDialog
        open={importing}
        apps={apps}
        onClose={() => setImporting(false)}
        onImported={(scene) => say(t("scenes.import.done", { name: scene.name }))}
      />
      {dialog}
      {notice && <Notice text={notice} />}
    </main>
  );
}
