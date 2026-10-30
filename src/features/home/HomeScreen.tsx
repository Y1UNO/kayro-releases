import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import { useMotionTokens } from "../../design/motion/current";
import { fmTransition } from "../../design/motion/tokens";
import { prefersReducedMotion } from "../../fx/motionPref";
import { useReducedMotion } from "../../fx/useReducedMotion";
import { t } from "../../i18n";
import { desktopIpc } from "../../ipc/commands";
import { SettingsDialog } from "../settings/SettingsDialog";
import type { AppEntry } from "../../ipc/bindings";
import { hubStore, useHub } from "../../store";
import { AddAppsDialog } from "../add-app/AddAppsDialog";
import { EditAppDialog } from "../add-app/EditAppDialog";
import { AppGrid } from "./AppGrid";
import { AppMenu, type MenuTarget } from "./AppMenu";
import { CATEGORY_IDS, groupByCategory, type CategoryId } from "./categories";
import { Carousel } from "./Carousel";
import { CategoryTabs } from "./CategoryTabs";
import { CategoryTitle } from "./CategoryTitle";
import { CommandPalette } from "./CommandPalette";
import { EmptyState } from "./EmptyState";
import { homeLeft, homeReducer, initialHomeState, rememberHome } from "./homeState";
import { useHomeSounds } from "./useHomeSounds";
import { LaunchToast } from "./LaunchToast";
import { DragGhost, Notice } from "./Overlays";
import { SceneDock } from "./SceneDock";
import { TopBar } from "./TopBar";
import { useArrange } from "./useArrange";
import { useCategoryDrag } from "./useCategoryDrag";
import { CategoryFan, FanTitle } from "./fan/CategoryFan";
import { useCategoryLink } from "./fan/useCategoryLink";
import { cardGeometry, useDa } from "../../design/da";
import { useHomeKeys } from "./useHomeKeys";
import { usePosterDrop } from "./usePosterDrop";
import { GameColorsBridge } from "../gameColors/GameColorsBridge";
import { LaunchIntro } from "../launchIntro/LaunchIntro";
import { startLaunch } from "../launchIntro/launchStore";
import styles from "./HomeScreen.module.css";

// 30/10: through the launch sequence of the app's ambience, when it has one (launchStore.ts).
const launch = (app: AppEntry) => startLaunch(app);

const NOTICE_MS = 4000;

/** Where a menu opened from the keyboard appears: on the selected card. */
function cardCentre(id: string): { x: number; y: number } {
  const r = document.querySelector(`[data-app-id="${CSS.escape(id)}"]`)?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 120, y: 160 };
}

/** Moves the keyboard focus along the cards of the category fan. */
function focusFanCard(delta: number): void {
  const cards = [...document.querySelectorAll<HTMLElement>("[data-fan-card]")];
  const at = cards.indexOf(document.activeElement as HTMLElement);
  const next = at < 0 ? Math.floor(cards.length / 2) : at + delta;
  cards[Math.min(cards.length - 1, Math.max(0, next))]?.focus();
}

/**
 * The home screen: top bar, category title, carousel (or grid), category tabs, scene dock.
 * Round 3b: at start-up, the categories in a fan first (`startOnFan`), linked to the carousel.
 */
export function HomeScreen({
  onOpenScenes,
  startOnFan = false,
}: {
  onOpenScenes: () => void;
  startOnFan?: boolean;
}) {
  const apps = useHub((s) => s.apps);
  const running = useHub((s) => s.running);
  const motion = useMotionTokens();
  const reduced = useReducedMotion();
  const groups = useMemo(() => groupByCategory(apps), [apps]);

  const [state, dispatch] = useReducer(
    homeReducer,
    groups,
    (g) =>
      homeLeft() ??
      initialHomeState(
        CATEGORY_IDS.find((id) => g[id].length > 0) ?? "jeux",
        Object.fromEntries(CATEGORY_IDS.map((id) => [id, g[id].length])) as Record<
          CategoryId,
          number
        >,
      ),
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hideOnEscape = useHub((s) => s.settings?.hideOnEscape ?? true);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [editing, setEditing] = useState<{ app: AppEntry; remove: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const columns = useRef(1);
  const panelId = useId();

  const list = groups[state.category];
  const count = list.length;
  const focus = Math.min(state.focus[state.category], Math.max(0, count - 1));
  const grid = state.view === "grid";
  useEffect(() => rememberHome(state), [state]);
  useHomeSounds(state.category, focus);

  // The confirmation disappears by itself; the timer exists only while one is shown.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

  const arrange = useArrange(setNotice);
  const { drag, onPointerDown } = useCategoryDrag(
    (id) => apps.find((a) => a.id === id),
    arrange.moveTo,
    arrange.dropNear,
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
  const link = useCategoryLink({
    category: state.category,
    setCategory,
    startOnFan,
    carousel: !grid,
  });
  const onFan = link.mode === "fan";
  const { fanMounted, fanParked, config: linkCfg } = link;
  const { fan: fanRef, area: areaRef, ask: askRef, title: titleRef, back: backRef } = link.bind;
  const { bottom: bottomRef, card: onFanCard } = link.bind;
  const slotH = cardGeometry(useDa((s) => s.values.cards)).activeH;
  const fill = useDa((s) => s.values.categoryLink?.fill);
  const counts = useMemo(
    () =>
      Object.fromEntries(CATEGORY_IDS.map((id) => [id, groups[id].length])) as Record<
        CategoryId,
        number
      >,
    [groups],
  );
  const onColumns = useCallback((n: number) => {
    columns.current = n;
  }, []);

  // Step 14: an image dropped on a card becomes its poster.
  usePosterDrop();
  useHomeKeys(
    {
      onArrow: (dx, dy) => {
        if (onFan) focusFanCard(dx || dy);
        else if (dx) move(dx);
        else if (grid) move(dy * columns.current);
      },
      onEdge: (edge) =>
        onFan || dispatch({ type: "setFocus", index: edge === "first" ? 0 : count - 1, count }),
      onCategoryStep: (delta) => {
        if (onFan) return;
        const i = CATEGORY_IDS.indexOf(state.category) + delta;
        const next = CATEGORY_IDS[Math.min(CATEGORY_IDS.length - 1, Math.max(0, i))];
        if (next) link.tab(next);
      },
      onEnter: () => {
        const app = onFan ? undefined : list[focus];
        if (app) launch(app);
      },
      // Escape closes what is open (grid view); with nothing left to close it hides the hub.
      // On the fan: the last category's carousel (the link plays towards its card).
      onEscape: () => {
        if (onFan) link.pick(state.category);
        else if (grid) dispatch({ type: "setView", view: "carousel" });
        else if (hideOnEscape) void desktopIpc.hide();
      },
      onSearch: () => setPaletteOpen(true),
      onEdit: () => {
        const app = onFan ? undefined : list[focus];
        if (app) setEditing({ app, remove: false });
      },
      onMenu: () => {
        const app = onFan ? undefined : list[focus];
        if (app) setMenu({ app, ...cardCentre(app.id) });
      },
      onNudge: (dir) => {
        const app = onFan ? undefined : list[focus];
        if (app && arrange.step(app, list, dir)) setFocus(focus + dir);
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
        dragging={drag !== null}
        floating={!onFan}
      />
    );

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>
        <main className={styles.screen}>
          {/* Step 14: the selected app's colours (the fan has none: back to the theme's). */}
          <GameColorsBridge activeId={onFan ? null : (list[focus]?.id ?? null)} />
          <LaunchIntro />
          <TopBar
            onSearch={() => setPaletteOpen(true)}
            onAdd={() => setAddOpen(true)}
            onSettings={() => setSettingsOpen(true)}
            onAllCategories={() => link.back()}
            allCategories={!onFan}
            backRef={backRef}
          />
          <div className={styles.titles}>
            <div ref={titleRef} aria-hidden={onFan || undefined} data-game-accents="">
              <CategoryTitle category={state.category} compact={grid && count > 0} />
            </div>
            <FanTitle askRef={askRef} shown={onFan} />
          </div>

          <div ref={areaRef} className={styles.area} data-game-accents="">
            {fanMounted && (
              <CategoryFan
                counts={counts}
                slotH={slotH}
                pivot={linkCfg.pivot}
                fill={typeof fill === "number" ? fill : 0.85}
                blur={linkCfg.blur}
                interactive={onFan}
                parked={fanParked}
                onPick={(cat) => link.pick(cat)}
                onHover={link.hover}
                onCard={onFanCard}
                fanRef={fanRef}
              />
            )}
            <div
              className={styles.panel}
              id={panelId}
              role="tabpanel"
              inert={onFan}
              onPointerDown={onPointerDown}
              onContextMenu={onAreaContextMenu}
              onClick={onAreaClick}
            >
              <AnimatePresence initial={false}>
                <m.div
                  // The carousel stays mounted across tabs (round 3b: the deck reuses its cards).
                  key={
                    count > 0 && !grid
                      ? "carousel"
                      : `${state.category}:${count === 0 ? "empty" : state.view}`
                  }
                  data-home-layer=""
                  className={styles.layer}
                  // A list that enters (level 2 of the motion table): rises on "liaison".
                  initial={{ opacity: 0, y: motion.rise }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: fmTransition(motion, 2, "moyen", "move", prefersReducedMotion()),
                  }}
                  exit={{
                    opacity: 0,
                    transition: fmTransition(
                      motion,
                      2,
                      "court",
                      "out",
                      prefersReducedMotion(),
                      true,
                    ),
                  }}
                >
                  {body}
                </m.div>
              </AnimatePresence>
            </div>
          </div>

          <div ref={bottomRef} className={styles.bottom} inert={onFan} data-game-accents="">
            <CategoryTabs
              category={state.category}
              view={state.view}
              dropTarget={drag?.over ?? null}
              panelId={panelId}
              onCategory={(cat) => link.tab(cat)}
              onView={(view) => dispatch({ type: "setView", view })}
            />
            <SceneDock onManage={onOpenScenes} />
          </div>
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
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
            onMove={arrange.moveTo}
            onNudge={(app, dir) => arrange.step(app, list, dir) && app === list[focus] && setFocus(focus + dir)}
          />
        )}
        {drag && <DragGhost name={drag.app.name} x={drag.x} y={drag.y} />}
        {notice && <Notice text={notice} />}
        <LaunchToast onFix={(app) => setEditing({ app, remove: false })} />
      </MotionConfig>
    </LazyMotion>
  );
}
