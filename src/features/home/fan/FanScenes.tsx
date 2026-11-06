import { useId, useRef, type KeyboardEvent } from "react";
import { Button, ScenesIcon } from "../../../design";
import { t } from "../../../i18n";
import { useScenes } from "../../../store";
import { usePlayScene } from "../../scenes/usePlayScene";
import { SceneButton } from "../SceneButton";
import styles from "./FanScenes.module.css";

/** Scenes shown under the fan; the others are one click away (the scene list). */
export const FAN_SCENES_MAX = 5;

interface Props {
  /** The fan is shown: the strip can be used (faded in and out by the director, like the title). */
  shown: boolean;
  /** Opens the scene list. */
  onManage: () => void;
  stripRef: (el: HTMLElement | null) => void;
}

/**
 * The scenes under the fan (2026-11-04): a small label and the first scenes as quiet pills, one
 * click starts one as in the dock. Always mounted (the director poses it from the first frame);
 * nothing shown without scenes.
 */
export function FanScenes({ shown, onManage, stripRef }: Props) {
  const scenes = useScenes((s) => s.scenes);
  const { request, dialog } = usePlayScene();
  const labelId = useId();
  const row = useRef<HTMLDivElement>(null);

  // ← → move along the pills (taken before the home keys, which would go back to the fan); ↑ goes
  // back to the fan, ↓ stays.
  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: 0 };
    const step = e.key === "Home" ? -Infinity : e.key === "End" ? Infinity : steps[e.key];
    if (step === undefined) return;
    const items = [...(row.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    items[Math.min(items.length - 1, Math.max(0, at + step))]?.focus();
  }

  return (
    <nav
      ref={stripRef}
      className={styles.strip}
      aria-labelledby={labelId}
      inert={!shown}
      hidden={scenes.length === 0}
      onKeyDown={onKeyDown}
    >
      <span id={labelId} className={styles.label}>
        {t("home.fan.scenes")}
      </span>
      <div ref={row} className={styles.row}>
        {scenes.slice(0, FAN_SCENES_MAX).map((scene) => (
          <SceneButton
            key={scene.id}
            scene={scene}
            size="sm"
            className={styles.item}
            onPlay={request}
          />
        ))}
        <Button size="sm" className={styles.all} onClick={onManage}>
          <ScenesIcon size={14} />
          {t("home.fan.allScenes")}
        </Button>
      </div>
      {dialog}
    </nav>
  );
}
