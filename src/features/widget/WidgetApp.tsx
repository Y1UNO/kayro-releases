import { useEffect, useRef, useState } from "react";
import { announceReady, useWindowShown } from "../../app/useWindowShown";
import { useTheme } from "../../design";
import { useMotionTokens } from "../../design/motion/current";
import type { AppEntry, SceneFile } from "../../ipc/bindings";
import { desktopIpc } from "../../ipc/commands";
import { doneCount, hubStore, useDesktop, useHub, useScenes } from "../../store";
import type { CategoryId } from "../home/categories";
import { usePlayScene } from "../scenes/usePlayScene";
import { useSceneHotkey } from "../scenes/useSceneHotkey";
import { WidgetBar } from "./WidgetBar";
import { WidgetPanel } from "./WidgetPanel";
import { useUnroll } from "./useUnroll";
import { useWidgetFit } from "./useWidgetFit";
import styles from "./Widget.module.css";

/** The widget window's whole page: the bar, and the panel that unfolds under it. */
export function WidgetApp() {
  const apps = useHub((s) => s.apps);
  const running = useHub((s) => s.running);
  const settings = useHub((s) => s.settings);
  const scenes = useScenes((s) => s.scenes);
  const run = useScenes((s) => s.run);
  const recents = useDesktop((s) => s.recents);

  const shell = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const bar = useRef<HTMLElement>(null);
  const { fitNow } = useWidgetFit(shell);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [query, setQuery] = useState("");
  const { request, dialog } = usePlayScene();

  const { setThemeId } = useTheme();
  const themeId = settings?.themeId;
  // The theme chosen in the other window (or earlier) is the one shown here.
  useEffect(() => {
    if (themeId) setThemeId(themeId);
  }, [themeId, setThemeId]);

  const style = settings?.widgetStyle ?? "brume";
  const hideOnEscape = settings?.hideOnEscape ?? true;
  const eco = settings?.quality === "eco";
  const motion = useMotionTokens().widget;
  // Round 4b: the glass unrolls when the panel opens; it stays mounted while it folds.
  const presence = useUnroll(open, { panel, bar }, fitNow, eco);

  // First reveal: measure with the real fonts, give the window that size, then say we are ready.
  useEffect(() => {
    let live = true;
    void (async () => {
      await document.fonts.ready;
      await fitNow();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (live) await announceReady();
    })();
    return () => {
      live = false;
    };
  }, [fitNow]);

  // A fresh start each time the widget comes back.
  useWindowShown(() => {
    setOpen(false);
    setQuery("");
    setCategory(null);
  });
  useSceneHotkey((scene) => {
    setOpen(true);
    request(scene);
  });

  // Escape folds the panel, then hides the widget; clicking another program folds the panel.
  useEffect(() => {
    const fold = () => {
      setOpen(false);
      setQuery("");
    };
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.getElementById("root")?.hasAttribute("inert")) return;
      if (open) fold();
      else if (hideOnEscape) void desktopIpc.hide();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", fold);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", fold);
    };
  }, [open, hideOnEscape]);

  const fold = () => {
    setOpen(false);
    setQuery("");
  };
  const playScene = (scene: SceneFile) => {
    setOpen(true);
    request(scene);
  };
  const launch = (app: AppEntry) => {
    void hubStore.getState().launchApp(app.id);
    fold();
  };

  const first = scenes[0] ?? null;
  const progress =
    first && run?.sceneId === first.id && run.status === null
      ? `${doneCount(run)}/${run.steps.length}`
      : null;

  return (
    <>
      <div
        ref={shell}
        className={styles.shell}
        data-style={style}
        data-panel={presence !== null || undefined}
      >
        <WidgetBar
          barRef={bar}
          category={category}
          open={open}
          sceneName={first?.name ?? null}
          sceneProgress={progress}
          onCategory={(id) => {
            if (open && category === id) fold();
            else {
              setCategory(id);
              setOpen(true);
            }
          }}
          onToggle={() => (open ? fold() : setOpen(true))}
          onSearch={() => setOpen(true)}
          onScene={() => {
            if (first) playScene(first);
          }}
        />
        {presence !== null && (
          <WidgetPanel
            panelRef={panel}
            glow={{
              halo: motion.halo && !eco,
              sheen: motion.sheen && !eco,
              haloAlpha: motion.haloAlpha,
            }}
            apps={apps}
            running={running}
            scenes={scenes}
            recents={recents}
            category={category}
            query={query}
            run={run}
            onQuery={setQuery}
            onLaunch={launch}
            onFront={(app) => void hubStore.getState().focusApp(app.id)}
            onScene={playScene}
          />
        )}
      </div>
      {dialog}
    </>
  );
}
