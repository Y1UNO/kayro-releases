import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { CATEGORY_IDS, CATEGORY_LABELS, categoryOf, type CategoryId } from "./categories";
import { PopMenu, type PopMenuItem } from "./PopMenu";

export interface MenuTarget {
  app: AppEntry;
  x: number;
  y: number;
}

interface Props {
  target: MenuTarget;
  onClose: () => void;
  onEdit: (app: AppEntry) => void;
  onRemove: (app: AppEntry) => void;
  onFavorite: (app: AppEntry) => void;
  /** Step 19b: to another category, and one place forward or backward in its own. */
  onMove: (app: AppEntry, category: CategoryId) => void;
  onNudge: (app: AppEntry, dir: -1 | 1) => void;
}

/** Context menu of an app (right click, context-menu key, Shift+F10). */
export function AppMenu({ target, onClose, onEdit, onRemove, onFavorite, onMove, onNudge }: Props) {
  const { app } = target;
  const here = categoryOf(app);
  const moves: PopMenuItem[] = CATEGORY_IDS.filter((c) => c !== here).map((c, i) => ({
    id: `move-${c}`,
    label: t("home.menu.moveTo", { category: t(CATEGORY_LABELS[c]) }),
    separated: i === 0,
    onSelect: () => onMove(app, c),
  }));
  return (
    <PopMenu
      x={target.x}
      y={target.y}
      label={t("home.menu.label", { name: app.name })}
      onClose={onClose}
      items={[
        { id: "edit", label: t("home.menu.edit"), onSelect: () => onEdit(app) },
        {
          id: "favorite",
          label: app.favorite ? t("home.menu.unfavorite") : t("home.menu.favorite"),
          onSelect: () => onFavorite(app),
        },
        {
          id: "backward",
          label: t("home.menu.backward"),
          shortcut: t("home.menu.keyBackward"),
          separated: true,
          onSelect: () => onNudge(app, -1),
        },
        {
          id: "forward",
          label: t("home.menu.forward"),
          shortcut: t("home.menu.keyForward"),
          onSelect: () => onNudge(app, 1),
        },
        ...moves,
        {
          id: "remove",
          label: t("home.menu.remove"),
          separated: true,
          onSelect: () => onRemove(app),
        },
      ]}
    />
  );
}
