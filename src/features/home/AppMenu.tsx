import {
  ArrowLeftIcon,
  ArrowRightIcon,
  EditIcon,
  MoveToIcon,
  RenameIcon,
  StarIcon,
  TrashIcon,
} from "../../design";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { CATEGORY_IDS, CATEGORY_LABELS, categoryOf, type CategoryId } from "./categories";
import { PopMenu } from "./PopMenu";
import { startRename } from "./RenameField";

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

const ICON = 16;

/**
 * Context menu of an app (right click, context-menu key, Shift+F10). Step 19c: six short lines —
 * edit, rename, favourite; backward / forward on one line; « Déplacer vers › » opens the
 * categories beside it; remove, in red.
 */
export function AppMenu({ target, onClose, onEdit, onRemove, onFavorite, onMove, onNudge }: Props) {
  const { app } = target;
  const here = categoryOf(app);
  return (
    <PopMenu
      x={target.x}
      y={target.y}
      label={t("home.menu.label", { name: app.name })}
      onClose={onClose}
      items={[
        {
          id: "edit",
          label: t("home.menu.edit"),
          icon: <EditIcon size={ICON} />,
          onSelect: () => onEdit(app),
        },
        {
          id: "rename",
          label: t("home.menu.rename"),
          icon: <RenameIcon size={ICON} />,
          onSelect: () => startRename(app.id),
        },
        {
          id: "favorite",
          label: app.favorite ? t("home.menu.unfavorite") : t("home.menu.favorite"),
          icon: <StarIcon size={ICON} fill={app.favorite ? "currentColor" : "none"} />,
          onSelect: () => onFavorite(app),
        },
        {
          id: "order",
          label: t("home.menu.order"),
          separated: true,
          row: [
            {
              id: "backward",
              label: t("home.menu.backward"),
              shortcut: t("home.menu.keyBackward"),
              icon: <ArrowLeftIcon size={ICON} />,
              onSelect: () => onNudge(app, -1),
            },
            {
              id: "forward",
              label: t("home.menu.forward"),
              shortcut: t("home.menu.keyForward"),
              icon: <ArrowRightIcon size={ICON} />,
              onSelect: () => onNudge(app, 1),
            },
          ],
        },
        {
          id: "move",
          label: t("home.menu.moveMenu"),
          icon: <MoveToIcon size={ICON} />,
          submenu: CATEGORY_IDS.filter((c) => c !== here).map((c) => ({
            id: `move-${c}`,
            label: t(CATEGORY_LABELS[c]),
            onSelect: () => onMove(app, c),
          })),
        },
        {
          id: "remove",
          label: t("home.menu.remove"),
          icon: <TrashIcon size={ICON} />,
          danger: true,
          separated: true,
          onSelect: () => onRemove(app),
        },
      ]}
    />
  );
}
