import { useEffect } from "react";
import { Button } from "../../design";
import { t } from "../../i18n";
import type { AppEntry, ArtRole } from "../../ipc/bindings";
import { artIpc } from "../../ipc/commands";
import { hubStore, useArt } from "../../store";
import { artUrl } from "../home/art";
import styles from "./AppLook.module.css";

const ROLES = ["poster", "hero", "logo", "charLeft", "charRight"] as const satisfies readonly ArtRole[];
const IMAGE = /\.(jpe?g|png|webp)$/i;

/** True inside the Tauri window; false in a plain browser (dev pages, tests). */
const insideTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function take(id: string, role: ArtRole, path: string): Promise<void> {
  const r = await artIpc.setUser(id, role, path);
  // Refused (not an image, too large): said in the home's message, like a drop on a card.
  if (!r.ok) hubStore.setState({ lastError: { ...r.error, field: "artImage" }, failedApp: null });
}

/**
 * One image dropped on a tile of the dialog becomes that image of the app (copied by the core,
 * which checks it). The home's own drop (usePosterDrop) is off while a dialog is open.
 */
function useTileDrop(id: string): void {
  useEffect(() => {
    if (!insideTauri()) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    void import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((event) => {
          const p = event.payload;
          if (p.type !== "drop" || p.paths.length !== 1 || !IMAGE.test(p.paths[0] ?? "")) return;
          const ratio = window.devicePixelRatio || 1;
          const at = document.elementFromPoint(p.position.x / ratio, p.position.y / ratio);
          const role = at?.closest<HTMLElement>("[data-art-role]")?.dataset.artRole as ArtRole;
          if (role) void take(id, role, p.paths[0]!);
        }),
      )
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch(() => {
        // No webview (dev page): the tiles only show the images.
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [id]);
}

/**
 * Step 14, edit dialog: the app's poster, background (hero) and logo; steps 16–17: the special
 * card's two cut-out characters (the user's only). Each tile shows the image in
 * use (the user's, else Steam's) and takes a dropped image; « Retirer » gives Steam's back.
 */
export function AppArtTiles({ app }: { app: AppEntry }) {
  const images = useArt((s) => s.byId[app.id]);
  useTileDrop(app.id);
  return (
    <div className={styles.tiles}>
      {ROLES.map((role) => {
        const image = images?.find((i) => i.role === role) ?? null;
        const label = t(`addApps.look.${role}`);
        return (
          <div key={role} className={styles.tile}>
            <div className={styles.drop} data-art-role={role} data-role={role}>
              {image ? (
                <img src={artUrl(app.id, image)} alt={label} draggable={false} />
              ) : (
                <span className={styles.none}>{t("addApps.look.none")}</span>
              )}
            </div>
            <span className={styles.tileLabel}>
              {label}
              {image && (
                <small>
                  {" · "}
                  {t(image.origin === "user" ? "addApps.look.fromYou" : "addApps.look.fromSteam")}
                </small>
              )}
            </span>
            {image?.origin === "user" && (
              <Button size="sm" onClick={() => void artIpc.clearUser(app.id, role)}>
                {t("addApps.look.remove")}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
