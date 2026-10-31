import { desktopIpc } from "../../ipc/commands";
import { hubStore } from "../../store";

/**
 * « Après l'intro » (Réglages › Démarrage): what the intro's opening ends on, once it is over.
 * The hub in immersive mode stays as it is; the island (Kysland) takes over, in a passage when
 * Kayro was in another mode; or the hub hides (notification area).
 */
export function afterIntro(): void {
  const s = hubStore.getState().settings;
  if (!s) return;
  if (s.startupAfter === "hidden") void desktopIpc.hide();
  else if (s.startupAfter === "island") {
    if (s.displayMode === "widget") void desktopIpc.startupIsland();
    else void hubStore.getState().setSettings({ displayMode: "widget" });
  }
}
