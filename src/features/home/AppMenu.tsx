import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { PopMenu } from "./PopMenu";

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
}

/** Context menu of an app (right click, context-menu key, Shift+F10). */
export function AppMenu({ target, onClose, onEdit, onRemove, onFavorite }: Props) {
  const { app } = target;
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
        { id: "remove", label: t("home.menu.remove"), onSelect: () => onRemove(app) },
      ]}
    />
  );
}
