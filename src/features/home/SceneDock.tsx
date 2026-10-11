import { useEffect } from "react";
import { Button, IconButton, MicIcon, PlusIcon, ScenesIcon, StopIcon, Surface } from "../../design";
import { t } from "../../i18n";
import { doneCount, sceneStore, useScenes } from "../../store";
import { usePlayScene } from "../scenes/usePlayScene";
import styles from "./SceneDock.module.css";

const RESULT_VISIBLE_MS = 5000;

interface Props {
  /** Opens the scene list (and, from there, the editor). */
  onManage: () => void;
}

/**
 * Scene dock: one button per scene (one click starts it), a discreet progress while one plays,
 * and the way into the scene list. The microphone is still the voice placeholder.
 */
export function SceneDock({ onManage }: Props) {
  const scenes = useScenes((s) => s.scenes);
  const run = useScenes((s) => s.run);
  const { request, dialog } = usePlayScene();
  const playing = run !== null && run.status === null;
  const finished = run?.status ?? null;

  // The result stays for a few seconds; the timer exists only while one is shown.
  useEffect(() => {
    if (finished === null) return;
    const id = window.setTimeout(() => sceneStore.getState().dismissRun(), RESULT_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [finished]);

  return (
    <Surface
      as="nav"
      radius="var(--da-bar-radius, var(--radius-4xl))"
      className={styles.dock}
      aria-label={t("home.dock.label")}
    >
      <div className={styles.scenes}>
        {scenes.map((scene, i) => {
          const mine = run?.sceneId === scene.id ? run : null;
          const active = mine !== null && mine.status === null;
          return (
            <Button
              key={scene.id}
              variant={i === 0 || active ? "primary" : "soft"}
              className={styles.item}
              disabled={playing && !active}
              aria-label={t("scenes.list.play", { name: scene.name })}
              onClick={() => (active ? void sceneStore.getState().cancel() : request(scene))}
            >
              <span>{scene.name}</span>
              {mine && (
                <span className={styles.progress} aria-live="polite">
                  {mine.status === null
                    ? `${doneCount(mine)}/${mine.steps.length}`
                    : t(`scenes.dock.${mine.status}`)}
                </span>
              )}
              {active && <StopIcon size={12} />}
            </Button>
          );
        })}
        {scenes.length === 0 && (
          <Button className={styles.item} onClick={onManage}>
            <PlusIcon size={16} />
            {t("home.dock.create")}
          </Button>
        )}
      </div>
      <span className={styles.separator} aria-hidden="true" />
      <IconButton label={t("home.dock.manage")} onClick={onManage}>
        <ScenesIcon size={20} />
      </IconButton>
      <IconButton label={t("home.voice")} disabled className={styles.disabled}>
        <MicIcon size={20} />
      </IconButton>
      {dialog}
    </Surface>
  );
}
