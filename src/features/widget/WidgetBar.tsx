import type { PointerEvent, RefObject } from "react";
import { APP_NAME } from "../../app/appName";
import { ChevronDownIcon, PlayIcon, SearchIcon } from "../../design";
import { t } from "../../i18n";
import { desktopIpc } from "../../ipc/commands";
import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from "../home/categories";
import styles from "./WidgetBar.module.css";

interface Props {
  /** Category whose panel is open (null when the panel shows the default view). */
  category: CategoryId | null;
  open: boolean;
  /** Name of the first scene, started by the button on the right. */
  sceneName: string | null;
  /** « 2/5 » while that scene plays. */
  sceneProgress: string | null;
  onCategory: (id: CategoryId) => void;
  onToggle: () => void;
  onSearch: () => void;
  onScene: () => void;
  /** The bar breathes a little when the panel unrolls (useUnroll). */
  barRef?: RefObject<HTMLElement | null>;
}

/** Grabbing the bar anywhere that is not a control moves the window. */
function startDrag(e: PointerEvent<HTMLElement>) {
  if (e.button !== 0) return;
  if (e.target instanceof Element && e.target.closest("button, input")) return;
  void desktopIpc.drag();
}

/** The widget's bar: mark, categories, search, panel toggle and the main scene. */
export function WidgetBar({
  category,
  open,
  sceneName,
  sceneProgress,
  onCategory,
  onToggle,
  onSearch,
  onScene,
  barRef,
}: Props) {
  return (
    <header
      ref={barRef}
      className={styles.bar}
      onPointerDown={startDrag}
      aria-label={t("widget.bar")}
    >
      <span className={styles.mark}>{APP_NAME}</span>
      <div className={styles.tabs} role="tablist" aria-label={t("home.categoriesNav")}>
        {CATEGORY_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={open && category === id}
            onClick={() => onCategory(id)}
          >
            {t(CATEGORY_LABELS[id])}
          </button>
        ))}
      </div>
      <span className={styles.grow} />
      <button
        type="button"
        className={styles.icon}
        aria-label={t("widget.search.label")}
        onClick={onSearch}
      >
        <SearchIcon />
      </button>
      <button
        type="button"
        className={styles.icon}
        aria-label={open ? t("widget.collapse") : t("widget.expand")}
        aria-expanded={open}
        onClick={onToggle}
      >
        <ChevronDownIcon className={styles.chevron} data-open={open} />
      </button>
      {sceneName && (
        <button
          type="button"
          className={styles.cta}
          aria-label={t("widget.mainScene", { name: sceneName })}
          onClick={onScene}
        >
          <PlayIcon size={12} />
          {sceneName}
          {sceneProgress && <span>{sceneProgress}</span>}
        </button>
      )}
    </header>
  );
}
