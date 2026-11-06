import { useCallback } from "react";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { hubStore } from "../../store";
import { nudge, placeNear } from "./arrange";
import { CATEGORY_LABELS, type CategoryId } from "./categories";

/**
 * Step 19b, putting the apps in order from the home screen: to another category (menu, drag onto
 * a tab), one place forward or backward (menu, Alt + arrows), or dropped near another card. The
 * store changes at once (the cards glide to their place), then the core saves it.
 */
export function useArrange(onNotice: (text: string) => void) {
  const moveTo = useCallback(
    (app: AppEntry, category: CategoryId) => {
      void hubStore
        .getState()
        .updateApp({ ...app, category })
        .then((r) => {
          if (!r.ok) return;
          onNotice(
            t("home.menu.moved", { name: app.name, category: t(CATEGORY_LABELS[category]) }),
          );
        });
    },
    [onNotice],
  );

  /** `visible`: the cards of the app's category, in their order. True when it moved. */
  const step = useCallback((app: AppEntry, visible: readonly AppEntry[], dir: -1 | 1) => {
    const { apps, reorderApps } = hubStore.getState();
    const order = nudge(
      apps.map((a) => a.id),
      visible.map((a) => a.id),
      app.id,
      dir,
    );
    if (!order) return false;
    void reorderApps(order);
    return true;
  }, []);

  const dropNear = useCallback((app: AppEntry, target: string, after: boolean) => {
    const { apps, reorderApps } = hubStore.getState();
    void reorderApps(placeNear(apps.map((a) => a.id), app.id, target, after));
  }, []);

  return { moveTo, step, dropNear };
}
