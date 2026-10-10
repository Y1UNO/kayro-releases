import { useEffect, useRef } from "react";
import type { SceneFile } from "../../ipc/bindings";
import { desktopIpc } from "../../ipc/commands";
import { onSceneHotkey } from "../../ipc/events";
import { sceneStore } from "../../store";

/**
 * A scene shortcut that needs the user's confirmation (the scene closes apps) shows the hub and
 * lands here: `request` then asks. Also picks up a request made while this page was still
 * loading.
 */
export function useSceneHotkey(request: (scene: SceneFile) => void): void {
  const latest = useRef(request);
  useEffect(() => {
    latest.current = request;
  });

  useEffect(() => {
    let live = true;
    const ask = async (id: string | null) => {
      if (!id) return;
      // The scene list may still be loading: wait for it for a moment.
      for (let i = 0; i < 20 && live; i++) {
        const scene = sceneStore.getState().scenes.find((s) => s.id === id);
        if (scene) return latest.current(scene);
        await new Promise((r) => setTimeout(r, 100));
      }
    };
    const unlisten = onSceneHotkey((id) => {
      void desktopIpc.takePendingScene().then(() => ask(id));
    });
    void desktopIpc.takePendingScene().then((r) => ask(r.ok ? r.value : null));
    return () => {
      live = false;
      void unlisten.then((off) => off());
    };
  }, []);
}
