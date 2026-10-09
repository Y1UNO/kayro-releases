import { useCallback, useId, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import { EASE, SPRING } from "../../design";
import type { AppEntry } from "../../ipc/bindings";
import { hubStore, useHub } from "../../store";
import { AddAppsDialog } from "../add-app/AddAppsDialog";
import { AppGrid } from "./AppGrid";
import { CATEGORY_IDS, groupByCategory, type CategoryId } from "./categories";
import { Carousel } from "./Carousel";
import { CategoryTabs } from "./CategoryTabs";
import { CategoryTitle } from "./CategoryTitle";
import { CommandPalette } from "./CommandPalette";
import { EmptyState } from "./EmptyState";
import { homeReducer, initialHomeState } from "./homeState";
import { LaunchToast } from "./LaunchToast";
import { SceneDock } from "./SceneDock";
import { TopBar } from "./TopBar";
import { useHomeKeys } from "./useHomeKeys";
import styles from "./HomeScreen.module.css";

const launch = (app: AppEntry) => void hubStore.getState().launchApp(app.id);

/** The home screen: top bar, category title, carousel (or grid), category tabs, scene dock. */
export function HomeScreen() {
  const apps = useHub((s) => s.apps);
  const running = useHub((s) => s.running);
  const groups = useMemo(() => groupByCategory(apps), [apps]);

  const [state, dispatch] = useReducer(homeReducer, groups, (g) =>
    initialHomeState(CATEGORY_IDS.find((id) => g[id].length > 0) ?? "jeux"),
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const columns = useRef(1);
  const panelId = useId();

  const list = groups[state.category];
  const count = list.length;
  const focus = Math.min(state.focus[state.category], Math.max(0, count - 1));
  const grid = state.view === "grid";

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
    },
    !paletteOpen,
  );

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
          <TopBar onSearch={() => setPaletteOpen(true)} />
          <CategoryTitle category={state.category} compact={grid && count > 0} />

          <div className={styles.area} id={panelId} role="tabpanel">
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
            panelId={panelId}
            onCategory={setCategory}
            onView={(view) => dispatch({ type: "setView", view })}
          />
          <SceneDock />
        </main>

        <CommandPalette
          open={paletteOpen}
          apps={apps}
          onClose={() => setPaletteOpen(false)}
          onPickApp={pickFromPalette}
          onPickCategory={setCategory}
        />
        <AddAppsDialog open={addOpen} onClose={() => setAddOpen(false)} />
        <LaunchToast />
      </MotionConfig>
    </LazyMotion>
  );
}
