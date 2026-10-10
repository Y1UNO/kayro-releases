import { useState } from "react";
import { t } from "../../i18n";
import type { SceneFile } from "../../ipc/bindings";
import { hubStore, sceneStore } from "../../store";
import { ConfirmDialog } from "./ConfirmDialog";
import { closeTargets } from "./model";
import styles from "./Editor.module.css";

/**
 * Starts a scene. When it has `close` steps, the apps that will be asked to close are listed
 * first and nothing happens until the user confirms (the core refuses a `close` otherwise).
 * `dialog` must be rendered by the caller.
 */
export function usePlayScene() {
  const [pending, setPending] = useState<{ scene: SceneFile; names: string[] } | null>(null);

  function request(scene: SceneFile) {
    const { slots } = sceneStore.getState();
    const names = closeTargets(scene.steps, slots, hubStore.getState().apps);
    if (names.length === 0) void sceneStore.getState().play(scene.id, false);
    else setPending({ scene, names });
  }

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={t("scenes.closeConfirm.title", { name: pending?.scene.name ?? "" })}
      confirmLabel={t("scenes.closeConfirm.yes")}
      cancelLabel={t("scenes.closeConfirm.no")}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        if (pending) void sceneStore.getState().play(pending.scene.id, true);
        setPending(null);
      }}
    >
      <p>{t("scenes.closeConfirm.text")}</p>
      <ul className={styles.confirmList}>
        {pending?.names.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <p className={styles.muted}>{t("scenes.closeConfirm.soft")}</p>
    </ConfirmDialog>
  );

  return { request, dialog };
}
