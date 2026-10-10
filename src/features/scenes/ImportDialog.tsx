import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Dialog, UploadIcon } from "../../design";
import { t } from "../../i18n";
import type { AppEntry, ImportPreview, SceneFile } from "../../ipc/bindings";
import { errorText } from "../../ipc/errors";
import { sceneStore } from "../../store";
import { useFileDrop } from "../add-app/useFileDrop";
import { slotLabel } from "./model";
import steps from "./Side.module.css";
import styles from "./Editor.module.css";

interface Props {
  open: boolean;
  apps: readonly AppEntry[];
  onClose: () => void;
  onImported: (scene: SceneFile) => void;
}

/** Import a `.hubscene`: pick the file, then link each of its slots to one of your own apps. */
export function ImportDialog({ open, apps, onClose, onImported }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("scenes.import.title")}
      closeLabel={t("scenes.close")}
    >
      <ImportBody apps={apps} onClose={onClose} onImported={onImported} />
    </Dialog>
  );
}

function ImportBody({ apps, onClose, onImported }: Omit<Props, "open">) {
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function inspect(raw: string) {
    const file = raw.trim().replace(/^"|"$/g, "");
    if (file === "") return;
    setError(null);
    const r = await sceneStore.getState().importPreview(file);
    if (!r.ok) {
      setError(r.error.code === "validation" ? t("scenes.import.refused") : errorText(r.error));
      return;
    }
    setPath(file);
    setPreview(r.value);
    setLinks(
      Object.fromEntries(
        r.value.slots.flatMap((s) => (s.suggestedApp ? [[s.name, s.suggestedApp]] : [])),
      ),
    );
  }

  const drop = useFileDrop((paths) => {
    const first = paths[0];
    if (first && !preview) void inspect(first);
  });

  async function submit() {
    if (!path) return;
    setBusy(true);
    const r = await sceneStore.getState().importScene(path, links);
    setBusy(false);
    if (r.ok) {
      onImported(r.value);
      onClose();
    } else setError(errorText(r.error));
  }

  if (!preview) {
    return (
      <div className={styles.importBody}>
        <div className={styles.zone} data-hover={drop.hovering || undefined}>
          <UploadIcon size={18} />
          {drop.hovering ? t("scenes.import.zoneActive") : t("scenes.import.zone")}
        </div>
        {!drop.available && <p className={styles.muted}>{t("scenes.import.browserOnly")}</p>}
        <form
          className={styles.pasteRow}
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void inspect(text);
          }}
        >
          <input
            className={steps.select}
            value={text}
            placeholder={t("scenes.import.pastePlaceholder")}
            aria-label={t("scenes.import.pasteLabel")}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={text.trim() === ""}>
            {t("scenes.import.analyse")}
          </Button>
        </form>
        {error && (
          <p className={styles.problem} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const missing = preview.slots.filter((s) => !links[s.name]).length;
  return (
    <div className={styles.importBody}>
      <p>{t("scenes.import.summary", { name: preview.name, count: preview.stepCount })}</p>
      <p className={styles.muted}>{t("scenes.import.linkIntro")}</p>
      <ul className={steps.slotList}>
        {preview.slots.map((slot) => (
          <li key={slot.name} className={steps.slot} data-warn={!links[slot.name] || undefined}>
            <span className={steps.slotName}>{slotLabel(slot.name)}</span>
            <select
              className={steps.select}
              aria-label={t("scenes.slots.linkLabel", { slot: slotLabel(slot.name) })}
              value={links[slot.name] ?? ""}
              onChange={(e) => setLinks((l) => ({ ...l, [slot.name]: e.target.value }))}
            >
              <option value="">{t("scenes.slots.unlinked")}</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {missing > 0 && (
        <p className={styles.warn}>{t("scenes.import.missing", { count: missing })}</p>
      )}
      {error && (
        <p className={styles.problem} role="alert">
          {error}
        </p>
      )}
      <div className={styles.confirmActions}>
        <Button onClick={() => setPreview(null)}>{t("scenes.import.other")}</Button>
        <Button variant="primary" disabled={busy} onClick={() => void submit()}>
          {t("scenes.import.go")}
        </Button>
      </div>
    </div>
  );
}
