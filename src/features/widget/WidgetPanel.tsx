import { useEffect, useRef } from "react";
import { SearchIcon } from "../../design";
import { t } from "../../i18n";
import type { AppEntry, AppRunState, SceneFile } from "../../ipc/bindings";
import { doneCount, type RunView } from "../../store";
import { CATEGORY_LABELS, type CategoryId } from "../home/categories";
import { monogram } from "../home/cardLook";
import { useAppIcon } from "../home/useAppIcon";
import { categoryApps, recentApps, runningApps, searchPanel } from "./widgetModel";
import styles from "./Widget.module.css";

interface Props {
  apps: readonly AppEntry[];
  running: Readonly<Record<string, AppRunState>>;
  scenes: readonly SceneFile[];
  recents: readonly string[];
  /** Category chosen in the bar: its apps replace « Récents ». */
  category: CategoryId | null;
  query: string;
  run: RunView | null;
  onQuery: (query: string) => void;
  onLaunch: (app: AppEntry) => void;
  onFront: (app: AppEntry) => void;
  onScene: (scene: SceneFile) => void;
}

function Avatar({ app }: { app: AppEntry }) {
  const icon = useAppIcon(app);
  return (
    <span className={styles.avatar} aria-hidden="true">
      {icon ? <img src={icon} alt={""} draggable={false} /> : monogram(app.name)}
    </span>
  );
}

/** What the widget shows when opened: search, scenes, running apps, and recents or a category. */
export function WidgetPanel({
  apps,
  running,
  scenes,
  recents,
  category,
  query,
  run,
  onQuery,
  onLaunch,
  onFront,
  onScene,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const searching = query.trim() !== "";
  const hits = searchPanel(query, apps, scenes);
  const open = runningApps(apps, running);
  const bottom = category ? categoryApps(apps, category) : recentApps(apps, recents);
  const playing = run !== null && run.status === null ? run : null;

  return (
    <section className={styles.panel} aria-label={t("widget.label")}>
      <label className={styles.search}>
        <SearchIcon />
        <input
          ref={input}
          type="text"
          value={query}
          placeholder={t("widget.search.placeholder")}
          aria-label={t("widget.search.label")}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>

      {searching ? (
        <div className={styles.results}>
          {hits.length === 0 && <p className={styles.empty}>{t("widget.search.noResults")}</p>}
          {hits.map((hit) =>
            hit.kind === "app" ? (
              <button
                key={`a:${hit.app.id}`}
                type="button"
                className={styles.hit}
                aria-label={t("widget.launch", { name: hit.app.name })}
                onClick={() => onLaunch(hit.app)}
              >
                <Avatar app={hit.app} />
                <span className={styles.name}>{hit.app.name}</span>
              </button>
            ) : (
              <button
                key={`s:${hit.scene.id}`}
                type="button"
                className={styles.hit}
                aria-label={t("scenes.list.play", { name: hit.scene.name })}
                onClick={() => onScene(hit.scene)}
              >
                <span className={styles.name}>{hit.scene.name}</span>
                <span className={styles.kind}>{t("widget.scenes")}</span>
              </button>
            ),
          )}
        </div>
      ) : (
        <>
          <div className={styles.columns}>
            <div className={`${styles.col} ${styles.scenesCol}`}>
              <h2 className={styles.heading}>{t("widget.scenes")}</h2>
              {scenes.length === 0 && <p className={styles.empty}>{t("widget.noScenes")}</p>}
              {scenes.slice(0, 4).map((scene, i) => (
                <button
                  key={scene.id}
                  type="button"
                  className={styles.scene}
                  data-primary={i === 0}
                  disabled={playing !== null && playing.sceneId !== scene.id}
                  onClick={() => onScene(scene)}
                >
                  <span>{scene.name}</span>
                  {playing?.sceneId === scene.id && (
                    <span className={styles.progress}>
                      {`${doneCount(playing)}/${playing.steps.length}`}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className={`${styles.col} ${styles.runningCol}`}>
              <h2 className={styles.heading}>{t("widget.running")}</h2>
              {open.length === 0 && <p className={styles.empty}>{t("widget.noRunning")}</p>}
              {open.slice(0, 4).map((app) => (
                <div key={app.id} className={styles.row}>
                  <Avatar app={app} />
                  <span className={styles.name}>{app.name}</span>
                  <span className={styles.open}>
                    <span className={styles.dot} aria-hidden="true" />
                    {t("widget.open")}
                  </span>
                  <button
                    type="button"
                    className={styles.front}
                    aria-label={t("widget.toFrontLabel", { name: app.name })}
                    disabled={running[app.id]?.foreground === true}
                    onClick={() => onFront(app)}
                  >
                    {t("widget.toFront")}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.col}>
            <h2 className={styles.heading}>
              {category ? t(CATEGORY_LABELS[category]) : t("widget.recents")}
            </h2>
            {bottom.length === 0 ? (
              <p className={styles.empty}>
                {category ? t("widget.noneInCategory") : t("widget.noRecents")}
              </p>
            ) : (
              <div className={styles.tiles}>
                {bottom.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className={styles.tile}
                    aria-label={t("widget.launch", { name: app.name })}
                    onClick={() => onLaunch(app)}
                  >
                    <Avatar app={app} />
                    <span className={styles.name}>{app.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
