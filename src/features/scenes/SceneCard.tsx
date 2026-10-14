import { useRef } from "react";
import { EditIcon, PlayIcon, ShareIcon, StopIcon, TrashIcon, useGlass } from "../../design";
import { t } from "../../i18n";
import type { AppEntry, SceneFile } from "../../ipc/bindings";
import { faceMixOf, monogram } from "../home/cardLook";
import { cssVars } from "../home/cssVars";
import { useAppIcon } from "../home/useAppIcon";
import styles from "./SceneCard.module.css";

interface Props {
  scene: SceneFile;
  /** The app its first step launches (its icon or letter is the card's face), if any. */
  app: AppEntry | null;
  playing: boolean;
  /** Another scene runs: this one cannot start. */
  busy: boolean;
  onPlay: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
}

/** No app: a launch without an icon (the hook then asks nothing). */
const NO_APP: Pick<AppEntry, "id" | "launch"> = { id: "", launch: { kind: "uri", uri: "" } };

/** A scene as a card, like the apps (round 5, proposal 4); a click opens it in the editor. */
export function SceneCard(p: Props) {
  const { scene, app } = p;
  const card = useRef<HTMLButtonElement>(null);
  useGlass(card, "card");
  const icon = useAppIcon(app ?? NO_APP);
  const steps = t(scene.steps.length === 1 ? "scenes.list.stepOne" : "scenes.list.stepMany", {
    count: scene.steps.length,
  });
  return (
    <li className={styles.item} data-playing={p.playing || undefined}>
      <button
        ref={card}
        type="button"
        className={styles.card}
        aria-label={t("scenes.list.card", { name: scene.name, steps })}
        onClick={p.onEdit}
      >
        <span className={styles.face} style={cssVars({ "--mix": `${faceMixOf(scene.id)}%` })} />
        {app && icon ? (
          <img className={styles.icon} src={icon} alt={""} draggable={false} decoding="async" />
        ) : (
          <span className={styles.letter} aria-hidden="true">
            {monogram(app?.name ?? scene.name)}
          </span>
        )}
        {scene.hotkey && <span className={styles.key}>{scene.hotkey}</span>}
        <span className={styles.plate}>
          <span className={styles.name}>{scene.name}</span>
          <span className={styles.steps}>{steps}</span>
        </span>
      </button>
      <div className={styles.actions}>
        {p.playing ? (
          <button
            type="button"
            className={styles.action}
            aria-label={t("scenes.list.cancel", { name: scene.name })}
            onClick={p.onCancel}
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="button"
            className={styles.action}
            aria-label={t("scenes.list.play", { name: scene.name })}
            disabled={p.busy}
            onClick={p.onPlay}
          >
            <PlayIcon />
          </button>
        )}
        <button
          type="button"
          className={styles.action}
          aria-label={t("scenes.list.edit", { name: scene.name })}
          onClick={p.onEdit}
        >
          <EditIcon size={16} />
        </button>
        <button
          type="button"
          className={styles.action}
          aria-label={t("scenes.list.export", { name: scene.name })}
          onClick={p.onExport}
        >
          <ShareIcon size={16} />
        </button>
        <button
          type="button"
          className={styles.action}
          aria-label={t("scenes.list.delete", { name: scene.name })}
          onClick={p.onDelete}
        >
          <TrashIcon size={16} />
        </button>
      </div>
    </li>
  );
}
