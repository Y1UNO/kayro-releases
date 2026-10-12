import { useEffect, useRef, useState } from "react";
import styles from "./App.module.css";
import { HomeScreen } from "./features/home/HomeScreen";
import { SceneEditor } from "./features/scenes/SceneEditor";
import { ScenesScreen } from "./features/scenes/ScenesScreen";
import { SceneToast } from "./features/scenes/SceneToast";
import type { NewSceneSeed } from "./features/scenes/draft";
import { t } from "./i18n";
import { errorText } from "./ipc/errors";
import { desktopStore, sceneStore, useHub } from "./store";
import { announceReady, useWindowShown } from "./app/useWindowShown";
import { usePlayScene } from "./features/scenes/usePlayScene";
import { useSceneHotkey } from "./features/scenes/useSceneHotkey";
import { Opening } from "./features/opening/Opening";
import { useOpening } from "./features/opening/useOpening";

/** Where the user is: the home screen, the list of scenes, or the editor of one scene. */
type Screen =
  | { name: "home" }
  | { name: "scenes" }
  | { name: "editor"; sceneId: string | null; seed?: NewSceneSeed };

export function App() {
  const status = useHub((s) => s.status);
  const error = useHub((s) => s.lastError);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const opening = useOpening();
  const under = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Show the (hidden) window only once the first frame is painted: no white flash.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void announceReady();
      }),
    );
  }, []);

  useEffect(() => {
    if (status === "ready") {
      void sceneStore.getState().init();
      void desktopStore.getState().init();
    }
  }, [status]);

  // Reports the paint time when a measurement is running; confirms a scene a shortcut asked for.
  useWindowShown();
  const { request, dialog } = usePlayScene();
  useSceneHotkey(request);

  if (status !== "ready") {
    return (
      <main className={styles.main}>
        {status === "failed" ? (
          <p>{error ? errorText(error) : t("app.loadFailed")}</p>
        ) : (
          <p>{t("app.loading")}</p>
        )}
      </main>
    );
  }

  const toScenes = () => setScreen({ name: "scenes" });
  return (
    <>
      <div
        ref={under}
        className={opening.hidden ? styles.under : styles.screens}
        style={opening.hidden && !opening.play ? { opacity: 0 } : undefined}
      >
        {screen.name === "home" && <HomeScreen onOpenScenes={toScenes} startOnFan={opening.fan} />}
        {screen.name === "scenes" && (
          <ScenesScreen
            onBack={() => setScreen({ name: "home" })}
            onEdit={(sceneId, seed) => setScreen({ name: "editor", sceneId, seed })}
          />
        )}
        {screen.name === "editor" && (
          <SceneEditor
            key={screen.sceneId ?? "new"}
            sceneId={screen.sceneId}
            seed={screen.seed}
            onBack={toScenes}
          />
        )}
      </div>
      {opening.play && <Opening under={under} onDone={opening.finish} />}
      <SceneToast />
      {dialog}
    </>
  );
}
