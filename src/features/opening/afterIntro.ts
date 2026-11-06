import { desktopIpc } from "../../ipc/commands";
import { hubStore } from "../../store";

/**
 * « Après l'intro » (Réglages › Démarrage): what the intro's opening ends on, once it is over.
 * The hub in immersive mode stays as it is; or it hides and the island (Kysland) comes; or it
 * hides and nothing is left on screen until Kayro is next shown.
 */
export function afterIntro(): void {
  const after = hubStore.getState().settings?.startupAfter;
  if (after === "island" || after === "hidden") void desktopIpc.introDone(after === "island");
}
