import { useEffect, useLayoutEffect, useRef } from "react";
import { Button, IconButton, PlusIcon, ScenesIcon, Surface } from "../../design";
import { currentMotion } from "../../design/motion/current";
import { durOf } from "../../design/motion/tokens";
import { prefersReducedMotion } from "../../fx/motionPref";
import { t } from "../../i18n";
import { sceneStore, useScenes } from "../../store";
import { usePlayScene } from "../scenes/usePlayScene";
import { SceneButton } from "./SceneButton";
import styles from "./SceneDock.module.css";
import { VoiceButton } from "../voice/VoiceButton";

const RESULT_VISIBLE_MS = 5000;

/** Scenes already shown in the dock (this page's life): a new one comes in on the spring. */
let known: Set<string> | null = null;

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
  const finished = run?.status ?? null;
  const loaded = useScenes((s) => s.loaded);
  const row = useRef<HTMLDivElement>(null);

  // Round 4b: a scene just created enters the dock rising on the "liaison" spring (level 2).
  useLayoutEffect(() => {
    if (!loaded) return;
    const ids = scenes.map((s) => s.id);
    if (!known) {
      known = new Set(ids);
      return;
    }
    const t = currentMotion();
    const ms = durOf(t, 2, "moyen", prefersReducedMotion());
    for (const id of ids) {
      if (known.has(id)) continue;
      known.add(id);
      const el = row.current?.querySelector<HTMLElement>(`[data-scene-id="${CSS.escape(id)}"]`);
      el?.animate(
        [
          { opacity: 0, translate: `0 ${t.rise}px` },
          { opacity: 1, translate: "0 0" },
        ],
        { duration: ms, easing: t.ease.move, fill: "backwards" },
      );
    }
  }, [loaded, scenes]);

  // The result stays for a few seconds; the timer exists only while one is shown.
  useEffect(() => {
    if (finished === null) return;
    const id = window.setTimeout(() => sceneStore.getState().dismissRun(), RESULT_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [finished]);

  return (
    <Surface
      as="nav"
      glassKind="dock"
      radius="var(--da-bar-radius, var(--radius-pill))"
      className={styles.dock}
      aria-label={t("home.dock.label")}
    >
      <div ref={row} className={styles.scenes}>
        {scenes.map((scene, i) => (
          <SceneButton
            key={scene.id}
            scene={scene}
            primary={i === 0}
            className={styles.item}
            onPlay={request}
          />
        ))}
        {scenes.length === 0 && (
          <Button className={styles.item} onClick={onManage}>
            <PlusIcon size={16} />
            {t("home.dock.create")}
          </Button>
        )}
      </div>
      <span className={styles.separator} aria-hidden="true" />
      <IconButton label={t("home.dock.manage")} glass onClick={onManage}>
        <ScenesIcon size={20} />
      </IconButton>
      {/* Step 21: shown while the voice is on (its indicator; a click mutes it). */}
      <VoiceButton />
      {dialog}
    </Surface>
  );
}
