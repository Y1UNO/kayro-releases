import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { IconButton, Surface } from "../../design";
import { t } from "../../i18n";
import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from "./categories";
import type { HomeView } from "./homeState";
import { GridIcon, RowsIcon } from "./viewIcons";
import styles from "./CategoryTabs.module.css";

interface Props {
  category: CategoryId;
  view: HomeView;
  /** Tab under a card being dragged (highlighted as a drop target). */
  dropTarget?: CategoryId | null;
  panelId: string;
  onCategory: (id: CategoryId) => void;
  onView: (view: HomeView) => void;
}

/** Category tabs (arrows / Home / End move and select) and the carousel / grid switch. */
export function CategoryTabs({
  category,
  view,
  dropTarget = null,
  panelId,
  onCategory,
  onView,
}: Props) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const last = CATEGORY_IDS.length - 1;
    const next =
      e.key === "ArrowRight"
        ? Math.min(last, index + 1)
        : e.key === "ArrowLeft"
          ? Math.max(0, index - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    const id = CATEGORY_IDS[next];
    if (id) onCategory(id);
    tabs.current[next]?.focus();
  }

  return (
    <div className={styles.row}>
      <div className={styles.group}>
        <Surface radius="var(--da-bar-radius, var(--radius-3xl))" className={styles.tabs}>
          <div
            role="tablist"
            aria-label={t("home.categoriesNav")}
            className={styles.list}
            data-own-keys
          >
            {CATEGORY_IDS.map((id, i) => {
              const selected = id === category;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  className={styles.tab}
                  data-drop-category={id}
                  data-drop-over={dropTarget === id || undefined}
                  onClick={() => onCategory(id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  {t(CATEGORY_LABELS[id])}
                </button>
              );
            })}
          </div>
        </Surface>
        {/* Beside the tabs (not in them): the tabs stay centred like in the mock-up. */}
        <IconButton
          label={view === "grid" ? t("home.view.toCarousel") : t("home.view.toGrid")}
          size="sm"
          className={styles.viewToggle}
          onClick={() => onView(view === "grid" ? "carousel" : "grid")}
        >
          {view === "grid" ? <RowsIcon /> : <GridIcon />}
        </IconButton>
      </div>
    </div>
  );
}
