import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Dialog } from "../../design";
import { t } from "../../i18n";
import type { SceneFile } from "../../ipc/bindings";
import type { NewSceneSeed } from "./draft";
import styles from "./NewScene.module.css";

type Start = "empty" | "from" | "import";

interface Props {
  open: boolean;
  scenes: readonly SceneFile[];
  onClose: () => void;
  /** Open the editor on a new scene: empty, or with the steps of another one. */
  onCreate: (seed: NewSceneSeed) => void;
  /** Import a `.hubscene` file instead (slot names only, never paths nor commands). */
  onImport: () => void;
}

/**
 * A new scene (round 4b, R4b-Etats.txt): a panel that appears (moyen) with its rows in a
 * cascade (45 ms), the name field focused at once, and three ways to start.
 */
export function NewSceneDialog({ open, scenes, onClose, onCreate, onImport }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={t("scenes.newScene.title")}>
      {/* A fresh form each time it opens. */}
      {open && (
        <NewSceneForm scenes={scenes} onClose={onClose} onCreate={onCreate} onImport={onImport} />
      )}
    </Dialog>
  );
}

function NewSceneForm({ scenes, onClose, onCreate, onImport }: Omit<Props, "open">) {
  const [name, setName] = useState("");
  const [start, setStart] = useState<Start>("empty");
  const [from, setFrom] = useState(scenes[0]?.id ?? "");
  const named = name.trim() !== "";
  const ready = start === "import" || (named && (start === "empty" || from !== ""));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    if (start === "import") onImport();
    else onCreate({ name: name.trim(), from: start === "from" ? from : null });
  }

  const option = (value: Start, title: string, text: string, disabled = false) => (
    <label className={styles.option} data-checked={start === value || undefined}>
      <input
        type="radio"
        name="new-scene-start"
        value={value}
        checked={start === value}
        disabled={disabled}
        onChange={() => setStart(value)}
      />
      <span className={styles.optionText}>
        <span className={styles.optionTitle}>{title}</span>
        <span className={styles.optionSub}>{text}</span>
      </span>
    </label>
  );

  return (
    <form className={styles.form} data-cascade onSubmit={submit}>
      <label className={styles.field}>
        <span>{t("scenes.newScene.name")}</span>
        <input
          className={styles.input}
          value={name}
          maxLength={60}
          placeholder={t("scenes.editor.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <fieldset className={styles.starts}>
        <legend className={styles.legend}>{t("scenes.newScene.start")}</legend>
        {option("empty", t("scenes.newScene.empty"), t("scenes.newScene.emptyText"))}
        {option(
          "from",
          t("scenes.newScene.from"),
          scenes.length > 0 ? t("scenes.newScene.fromText") : t("scenes.newScene.noScene"),
          scenes.length === 0,
        )}
        {start === "from" && (
          <select
            className={styles.input}
            aria-label={t("scenes.newScene.fromPick")}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        {option("import", t("scenes.newScene.import"), t("scenes.newScene.importText"))}
      </fieldset>
      <div className={styles.actions}>
        {start !== "import" && !named && (
          <span className={styles.hint}>{t("scenes.newScene.nameNeeded")}</span>
        )}
        <Button type="button" onClick={onClose}>
          {t("scenes.newScene.cancel")}
        </Button>
        <Button type="submit" variant="primary" disabled={!ready}>
          {start === "import" ? t("scenes.newScene.import") : t("scenes.newScene.create")}
        </Button>
      </div>
    </form>
  );
}
