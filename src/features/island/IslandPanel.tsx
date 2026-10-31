import { useEffect, useLayoutEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { SearchIcon } from "../../design";
import { t } from "../../i18n";
import type { MediaAction, NowPlaying } from "../../ipc/bindings";
import type { WidgetHit } from "../widget/widgetModel";
import { AppMark } from "./AppMark";
import { progressAt, trackKey } from "./music";
import styles from "./IslandPanel.module.css";

interface Props {
  /** Opened: the content can be used (it fades in once the island has grown). */
  open: boolean;
  query: string;
  hits: readonly WidgetHit[];
  selected: number;
  np: NowPlaying | null;
  onQuery: (q: string) => void;
  onSelect: (i: number) => void;
  onLaunch: (hit: WidgetHit) => void;
  onMedia: (action: MediaAction) => void;
  onImmersive: () => void;
  onClose: () => void;
}

/** A soft triangle (rounded corners) pointing left or right: a track back or ahead, play. */
function Triangle({ left, size = 16 }: { left?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d={left ? "M11 3.5 L4.5 8 L11 12.5 Z" : "M5 3.5 L11.5 8 L5 12.5 Z"}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Four arrows to the corners: the island grows into the immersive mode. */
function Grow() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 7 3 3M3 6.5V3h3.5" />
        <path d="M11 7l4-4M11.5 3H15v3.5" />
        <path d="M7 11l-4 4M3 11.5V15h3.5" />
        <path d="M11 11l4 4M15 11.5V15h-3.5" />
      </g>
    </svg>
  );
}

/** Two bars: pause. */
function Pause() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="3" width="3" height="10" rx="1.5" fill="currentColor" />
      <rect x="9.5" y="3" width="3" height="10" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/** The track's progress: one CSS transition to its end while it plays (no loop of ours). */
function Progress({ np }: { np: NowPlaying }) {
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const { pct, remainingMs } = progressAt(np, Date.now());
    el.style.transition = "none";
    el.style.transform = `scaleX(${pct})`;
    if (!np.playing || remainingMs <= 0) return;
    void el.offsetWidth;
    el.style.transition = `transform ${Math.round(remainingMs)}ms linear`;
    el.style.transform = "scaleX(1)";
  }, [np]);
  return (
    <span className={styles.progress}>
      <i ref={bar} />
    </span>
  );
}

/**
 * Step 20 (Kysland): the opened island. A search (apps and scenes; Enter starts the one chosen,
 * arrows choose), the music playing (cover: play or pause; triangles: the track before or
 * after), and the way to the immersive mode. The running apps stay on the island at rest.
 */
export function IslandPanel(p: Props) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!p.open) return;
    // The core gives the island the keyboard as it opens.
    const id = window.setTimeout(() => input.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [p.open]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = p.hits.length;
    if (e.key === "ArrowDown" && n > 0) p.onSelect((p.selected + 1) % n);
    else if (e.key === "ArrowUp" && n > 0) p.onSelect((p.selected - 1 + n) % n);
    else if (e.key === "Enter") {
      const hit = p.hits[p.selected];
      if (hit) p.onLaunch(hit);
    } else if (e.key === "Escape") p.onClose();
    else return;
    e.preventDefault();
  };
  const tab = p.open ? 0 : -1;
  const np = p.np;

  return (
    <div className={styles.panel} data-open={p.open || undefined} aria-hidden={!p.open}>
      <div className={styles.inner}>
        <div className={styles.searchRow}>
          <label className={styles.search}>
            <SearchIcon />
            <input
              ref={input}
              value={p.query}
              tabIndex={tab}
              placeholder={t("island.search.placeholder")}
              aria-label={t("island.search.label")}
              onChange={(e) => p.onQuery(e.target.value)}
              onKeyDown={onKey}
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className={styles.round}
            tabIndex={tab}
            title={t("island.toImmersive")}
            aria-label={t("island.toImmersive")}
            onClick={p.onImmersive}
          >
            <Grow />
          </button>
        </div>
        {p.query.trim() !== "" ? (
          <div className={styles.results} role="listbox" aria-label={t("island.search.label")}>
            {p.hits.length === 0 && <p className={styles.empty}>{t("island.search.none")}</p>}
            {p.hits.map((hit, i) => {
              const name = hit.kind === "app" ? hit.app.name : hit.scene.name;
              return (
                <button
                  key={hit.kind === "app" ? hit.app.id : hit.scene.id}
                  type="button"
                  role="option"
                  aria-selected={i === p.selected}
                  tabIndex={-1}
                  className={styles.result}
                  onMouseEnter={() => p.onSelect(i)}
                  onClick={() => p.onLaunch(hit)}
                >
                  {hit.kind === "app" ? (
                    <AppMark app={hit.app} size={22} />
                  ) : (
                    <span className={styles.sceneMark}>
                      <Triangle />
                    </span>
                  )}
                  <span className={styles.resultName}>{name}</span>
                  {hit.kind === "scene" && <small>{t("island.search.scene")}</small>}
                </button>
              );
            })}
          </div>
        ) : np ? (
          <div className={styles.music}>
            <button
              type="button"
              className={styles.cover}
              tabIndex={tab}
              data-playing={np.playing || undefined}
              aria-label={np.playing ? t("island.music.pause") : t("island.music.play")}
              onClick={() => p.onMedia("toggle")}
            >
              {np.cover && <img key={trackKey(np)} src={np.cover} alt={""} draggable={false} />}
              <span className={styles.coverIcon} aria-hidden="true">
                {np.playing ? <Pause /> : <Triangle />}
              </span>
            </button>
            <div className={styles.meta}>
              <strong className={styles.title}>{np.title}</strong>
              <span className={styles.artist}>{np.artist}</span>
              <Progress np={np} />
            </div>
            <div className={styles.controls}>
              <button
                type="button"
                tabIndex={tab}
                aria-label={t("island.music.previous")}
                onClick={() => p.onMedia("previous")}
              >
                <Triangle left />
              </button>
              <button
                type="button"
                tabIndex={tab}
                aria-label={t("island.music.next")}
                onClick={() => p.onMedia("next")}
              >
                <Triangle />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.music}>
            <p className={styles.empty}>{t("island.music.none")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
