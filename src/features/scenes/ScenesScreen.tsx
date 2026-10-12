import { useMemo, useState } from "react";
import { Button, PlusIcon, SearchIcon, UploadIcon } from "../../design";
import { t } from "../../i18n";
import type { SceneFile } from "../../ipc/bindings";
import { sceneStore, useHub, useScenes } from "../../store";
import { Notice } from "../home/Overlays";
import bar from "../home/TopBar.module.css";
import { BarBack, TopBarShell } from "../home/TopBarShell";
import { ConfirmDialog } from "./ConfirmDialog";
import type { NewSceneSeed } from "./draft";
import { ImportDialog } from "./ImportDialog";
import { NewSceneDialog } from "./NewSceneDialog";
import { slotsOf } from "./model";
import { SceneCard } from "./SceneCard";
import { ScreenTitle } from "./ScreenTitle";
import { usePlayScene } from "./usePlayScene";
import cards from "./SceneCard.module.css";
import styles from "./Screens.module.css";

interface Props {
  onBack: () => void;
  /** null = a new scene (with how it starts). */
  onEdit: (id: string | null, seed?: NewSceneSeed) => void;
}

/**
 * All scenes (round 5, proposal 4: in the home screen's language): the shared top bar (back home,
 * a search that filters the scenes, import, new scene), the title signature, the scenes as cards
 * like the apps — play, edit, export, delete on hover and keyboard focus.
 */
export function ScenesScreen({ onBack, onEdit }: Props) {
  const apps = useHub((s) => s.apps);
  const scenes = useScenes((s) => s.scenes);
  const slots = useScenes((s) => s.slots);
  const run = useScenes((s) => s.run);
  const { request, dialog } = usePlayScene();
  const [deleting, setDeleting] = useState<SceneFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const busy = run !== null && run.status === null;
  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? scenes.filter((s) => s.name.toLocaleLowerCase().includes(q)) : scenes;
  }, [scenes, query]);

  function say(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function exportScene(scene: SceneFile) {
    const r = await sceneStore.getState().exportScene(scene.id);
    if (r.ok) say(t("scenes.list.exported", { file: r.value.split(/[\\/]/).pop() ?? r.value }));
  }

  /** The app its first launched slot points to: its icon or letter is the card's face. */
  const firstApp = (scene: SceneFile) => {
    const slot = slotsOf(scene.steps)[0];
    return (slot && apps.find((a) => a.id === slots[slot])) || null;
  };

  return (
    <main className={styles.screen}>
      <TopBarShell
        left={<BarBack label={t("scenes.list.back")} onClick={onBack} />}
        center={
          <label className={`${bar.search} ${styles.searchBox}`}>
            <SearchIcon size={16} />
            <input
              className={styles.searchInput}
              value={query}
              placeholder={t("scenes.list.search")}
              aria-label={t("scenes.list.search")}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        }
        right={
          <>
            <Button size="sm" onClick={() => setImporting(true)}>
              <UploadIcon size={16} />
              {t("scenes.list.import")}
            </Button>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              <PlusIcon size={16} />
              {t("scenes.list.new")}
            </Button>
          </>
        }
      />
      <div className={styles.scroll}>
        <div className={styles.frame}>
          <ScreenTitle eyebrow={t("scenes.list.eyebrow")}>
            <h1 className={styles.title}>{t("scenes.list.heading")}</h1>
          </ScreenTitle>
          {scenes.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t("scenes.list.emptyTitle")}</p>
              <p className={styles.muted}>{t("scenes.list.emptyText")}</p>
            </div>
          ) : shown.length === 0 ? (
            <p className={`${styles.muted} ${styles.empty}`} role="status">
              {t("scenes.list.noMatch", { query: query.trim() })}
            </p>
          ) : (
            <ul className={cards.grid} aria-label={t("scenes.list.title")}>
              {shown.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  app={firstApp(scene)}
                  playing={busy && run?.sceneId === scene.id}
                  busy={busy}
                  onPlay={() => request(scene)}
                  onCancel={() => void sceneStore.getState().cancel()}
                  onEdit={() => onEdit(scene.id)}
                  onExport={() => void exportScene(scene)}
                  onDelete={() => setDeleting(scene)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

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
      <NewSceneDialog
        open={creating}
        scenes={scenes}
        onClose={() => setCreating(false)}
        onCreate={(seed) => {
          setCreating(false);
          onEdit(null, seed);
        }}
        onImport={() => {
          setCreating(false);
          setImporting(true);
        }}
      />
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
