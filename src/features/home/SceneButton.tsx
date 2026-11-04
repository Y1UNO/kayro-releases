import { Button, StopIcon } from "../../design";
import { t } from "../../i18n";
import type { SceneFile } from "../../ipc/bindings";
import { doneCount, sceneStore, useScenes } from "../../store";
import styles from "./SceneButton.module.css";

interface Props {
  scene: SceneFile;
  /** Accent fill (the dock's first scene); the scene playing always has it. */
  primary?: boolean;
  size?: "md" | "sm";
  className?: string;
  /** Starts the scene (usePlayScene's `request`: asks first when it closes apps). */
  onPlay: (scene: SceneFile) => void;
}

/**
 * One scene as a pill (the dock, the fan's scene strip): one click starts it, a second one while
 * it plays stops it; its progress, then its result, shows beside the name.
 */
export function SceneButton({ scene, primary = false, size, className, onPlay }: Props) {
  const run = useScenes((s) => s.run);
  const mine = run?.sceneId === scene.id ? run : null;
  const active = mine !== null && mine.status === null;
  const playing = run !== null && run.status === null;
  return (
    <Button
      data-scene-id={scene.id}
      variant={primary || active ? "primary" : "soft"}
      size={size}
      className={className}
      disabled={playing && !active}
      aria-label={t("scenes.list.play", { name: scene.name })}
      onClick={() => (active ? void sceneStore.getState().cancel() : onPlay(scene))}
    >
      <span className={styles.name}>{scene.name}</span>
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
}
