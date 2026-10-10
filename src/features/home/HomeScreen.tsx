import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import { EASE, SPRING } from "../../design";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { hubStore, useHub } from "../../store";
import { AddAppsDialog } from "../add-app/AddAppsDialog";
import { EditAppDialog } from "../add-app/EditAppDialog";
import { AppGrid } from "./AppGrid";
import { AppMenu, type MenuTarget } from "./AppMenu";
import { CATEGORY_IDS, CATEGORY_LABELS, groupByCategory, type CategoryId } from "./categories";
import { Carousel } from "./Carousel";
import { CategoryTabs } from "./CategoryTabs";
import { CategoryTitle } from "./CategoryTitle";
import { CommandPalette } from "./CommandPalette";
import { EmptyState } from "./EmptyState";
import { homeReducer, initialHomeState } from "./homeState";
import { LaunchToast } from "./LaunchToast";
import { DragGhost, Notice } from "./Overlays";
import { SceneDock } from "./SceneDock";
import { TopBar } from "./TopBar";
import { useCategoryDrag } from "./useCategoryDrag";
import { useHomeKeys } from "./useHomeKeys";
import styles from "./HomeScreen.module.css";

const launch = (app: AppEntry) => void hubStore.getState().launchApp(app.id);

const NOTICE_MS = 4000;

/** Where a menu opened from the keyboard appears: on the selected card. */
function cardCentre(id: string): { x: number; y: number } {
  const r = document.querySelector(`[data-app-id="${CSS.escape(id)}"]`)?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 120, y: 160 };
}

/** The home screen: top bar, category title, carousel (or grid), category tabs, scene dock. */
export function HomeScreen({ onOpenScenes }: { onOpenScenes: () => void }) {
  const apps = useHub((s) => s.apps);
  const running = useHub((s) => s.running);
  const groups = useMemo(() => groupByCategory(apps), [apps]);

  const [state, dispatch] = useReducer(homeReducer, groups, (g) =>
    initialHomeState(CATEGORY_IDS.find((id) => g[id].length > 0) ?? "jeux"),
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [editing, setEditing] = useState<{ app: AppEntry; remove: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const columns = useRef(1);
  const panelId = useId();

  const list = groups[state.category];
  const count = list.length;
  const focus = Math.min(state.focus[state.category], Math.max(0, count - 1));
  const grid = state.view === "grid";

  // The confirmation disappears by itself; the timer exists only while one is shown.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

  const { drag, onPointerDown } = useCategoryDrag(
    (id) => apps.find((a) => a.id === id),
    (app, category) => {
      void hubStore
        .getState()
        .updateApp({ ...app, category })
        .then((r) => {
          if (r.ok) {
            setNotice(
              t("home.menu.moved", { name: app.name, category: t(CATEGORY_LABELS[category]) }),
            );
          }
        });
    },
  );

  const setFocus = useCallback(
    (index: number) => dispatch({ type: "setFocus", index, count }),
    [count],
  );
  const move = useCallback(
    (delta: number) => dispatch({ type: "moveFocus", delta, count }),
    [count],
  );
  const setCategory = useCallback(
    (category: CategoryId) => dispatch({ type: "setCategory", category }),
    [],
  );
  const onColumns = useCallback((n: number) => {
    columns.current = n;
  }, []);

  useHomeKeys(
    {
      onArrow: (dx, dy) => {
        if (dx) move(dx);
        else if (grid) move(dy * columns.current);
      },
      onEdge: (edge) =>
        dispatch({ type: "setFocus", index: edge === "first" ? 0 : count - 1, count }),
      onCategoryStep: (delta) => dispatch({ type: "stepCategory", delta }),
      onEnter: () => {
        const app = list[focus];
        if (app) launch(app);
      },
      onEscape: () => dispatch({ type: "setView", view: "carousel" }),
      onSearch: () => setPaletteOpen(true),
      onEdit: () => {
        const app = list[focus];
        if (app) setEditing({ app, remove: false });
      },
      onMenu: () => {
        const app = list[focus];
        if (app) setMenu({ app, ...cardCentre(app.id) });
      },
    },
    !paletteOpen && !menu,
  );

  function onAreaContextMenu(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;
    const id = e.target.closest<HTMLElement>("[data-app-id]")?.dataset.appId;
    const app = id ? apps.find((a) => a.id === id) : list[focus];
    if (!app) return;
    e.preventDefault();
    setMenu({ app, x: e.clientX, y: e.clientY });
  }

  function onAreaClick(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;
    const id = e.target.closest<HTMLElement>("[data-edit-app]")?.dataset.editApp;
    const app = id ? apps.find((a) => a.id === id) : undefined;
    if (app) setEditing({ app, remove: false });
  }

  function pickFromPalette(app: AppEntry) {
    const groupId = CATEGORY_IDS.find((id) => groups[id].includes(app));
    if (groupId) {
      dispatch({ type: "setCategory", category: groupId });
      dispatch({
        type: "setFocus",
        index: groups[groupId].indexOf(app),
        count: groups[groupId].length,
      });
    }
    launch(app);
  }

  const body =
    count === 0 ? (
      <EmptyState scope={apps.length === 0 ? "all" : "category"} onAdd={() => setAddOpen(true)} />
    ) : grid ? (
      <AppGrid
        apps={list}
        focus={focus}
        running={running}
        onColumns={onColumns}
        onFocus={setFocus}
        onLaunch={launch}
      />
    ) : (
      <Carousel
        apps={list}
        focus={focus}
        running={running}
        onFocus={setFocus}
        onMove={move}
        onLaunch={launch}
      />
    );

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <main className={styles.screen}>
          <TopBar onSearch={() => setPaletteOpen(true)} onAdd={() => setAddOpen(true)} />
          <CategoryTitle category={state.category} compact={grid && count > 0} />

          <div
            className={styles.area}
            id={panelId}
            role="tabpanel"
            onPointerDown={onPointerDown}
            onContextMenu={onAreaContextMenu}
            onClick={onAreaClick}
          >
            <AnimatePresence initial={false}>
              <m.div
                key={`${state.category}:${count === 0 ? "empty" : state.view}`}
                className={styles.layer}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: SPRING }}
                exit={{ opacity: 0, transition: { duration: 0.18, ease: EASE } }}
              >
                {body}
              </m.div>
            </AnimatePresence>
          </div>

          <CategoryTabs
            category={state.category}
            view={state.view}
            dropTarget={drag?.over ?? null}
            panelId={panelId}
            onCategory={setCategory}
            onView={(view) => dispatch({ type: "setView", view })}
          />
          <SceneDock onManage={onOpenScenes} />
        </main>

        <CommandPalette
          open={paletteOpen}
          apps={apps}
          onClose={() => setPaletteOpen(false)}
          onPickApp={pickFromPalette}
          onPickCategory={setCategory}
        />
        <AddAppsDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdded={(count) =>
            setNotice(t(count === 1 ? "addApps.addedOne" : "addApps.addedMany", { count }))
          }
        />
        <EditAppDialog
          app={editing?.app ?? null}
          startWithRemove={editing?.remove}
          onClose={() => setEditing(null)}
        />
        {menu && (
          <AppMenu
            target={menu}
            onClose={() => setMenu(null)}
            onEdit={(app) => setEditing({ app, remove: false })}
            onRemove={(app) => setEditing({ app, remove: true })}
            onFavorite={(app) =>
              void hubStore.getState().updateApp({ ...app, favorite: !app.favorite })
            }
          />
        )}
        {drag && <DragGhost name={drag.app.name} x={drag.x} y={drag.y} />}
        {notice && <Notice text={notice} />}
        <LaunchToast />
      </MotionConfig>
    </LazyMotion>
  );
}
