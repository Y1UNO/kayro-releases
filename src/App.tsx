import { useEffect, useState } from "react";
import styles from "./App.module.css";
import { HomeScreen } from "./features/home/HomeScreen";
import { SceneEditor } from "./features/scenes/SceneEditor";
import { ScenesScreen } from "./features/scenes/ScenesScreen";
import { SceneToast } from "./features/scenes/SceneToast";
import { t } from "./i18n";
import { ipc } from "./ipc/commands";
import { errorText } from "./ipc/errors";
import { sceneStore, useHub } from "./store";

/** Where the user is: the home screen, the list of scenes, or the editor of one scene. */
type Screen = { name: "home" } | { name: "scenes" } | { name: "editor"; sceneId: string | null };

export function App() {
  const status = useHub((s) => s.status);
  const error = useHub((s) => s.lastError);
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  useEffect(() => {
    // Show the (hidden) window only once the first frame is painted: no white flash.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void ipc.appReady();
      }),
    );
  }, []);

  useEffect(() => {
    if (status === "ready") void sceneStore.getState().init();
  }, [status]);

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
      {screen.name === "home" && <HomeScreen onOpenScenes={toScenes} />}
      {screen.name === "scenes" && (
        <ScenesScreen
          onBack={() => setScreen({ name: "home" })}
          onEdit={(sceneId) => setScreen({ name: "editor", sceneId })}
        />
      )}
      {screen.name === "editor" && (
        <SceneEditor key={screen.sceneId ?? "new"} sceneId={screen.sceneId} onBack={toScenes} />
      )}
      <SceneToast />
    </>
  );
}
