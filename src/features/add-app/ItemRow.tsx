import { t } from "../../i18n";
import { CATEGORY_IDS, CATEGORY_LABELS } from "../home/categories";
import { monogram } from "../home/cardLook";
import type { Item, Origin } from "./items";
import { useItemIcon } from "./useItemIcon";
import styles from "./AddApps.module.css";
import extra from "./Detected.module.css";

const ORIGIN_LABELS = {
  steam: "addApps.detected.sourceSteam",
  epic: "addApps.detected.sourceEpic",
  startmenu: "addApps.detected.sourceStartmenu",
  deep: "addApps.detected.sourceDeep",
  drop: null,
} as const satisfies Record<Origin, string | null>;

interface Props {
  item: Item;
  checked: boolean;
  name: string;
  category: string;
  editableName: boolean;
  onToggle: (key: string) => void;
  onName: (key: string, name: string) => void;
  onCategory: (key: string, category: string) => void;
  /** « Ignorer » / « Ne plus ignorer » (detected apps, 19b). */
  onIgnore?: (key: string, ignored: boolean) => void;
}

/** The app's own logo (19b), its monogram until it is there or when it has none. */
function Tile({ item, name }: { item: Item; name: string }) {
  const icon = useItemIcon(item);
  return (
    <span className={`${styles.tile} ${extra.tile}`} data-icon={icon ? "" : undefined} aria-hidden="true">
      {icon ? (
        <img className={extra.tileIcon} src={icon} alt={""} draggable={false} decoding="async" />
      ) : (
        monogram(name)
      )}
    </span>
  );
}

/** One proposed app: checkbox, logo, name, source, category, « Ignorer ». A click selects. */
export function ItemRow({
  item,
  checked,
  name,
  category,
  editableName,
  onToggle,
  onName,
  onCategory,
  onIgnore,
}: Props) {
  const origin = ORIGIN_LABELS[item.origin];
  const locked = item.alreadyAdded || item.ignored;
  return (
    <li
      className={styles.row}
      data-disabled={locked || undefined}
      onClick={() => !locked && onToggle(item.key)}
    >
      <input
        type="checkbox"
        className={styles.box}
        checked={checked && !locked}
        disabled={locked}
        aria-label={t("addApps.row.pick", { name })}
        onChange={() => onToggle(item.key)}
        onClick={(e) => e.stopPropagation()}
      />
      <Tile item={item} name={name} />
      {editableName && !locked ? (
        <input
          className={`${styles.input} ${styles.nameInput}`}
          value={name}
          maxLength={80}
          aria-label={t("addApps.row.name", { name: item.name })}
          onChange={(e) => onName(item.key, e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className={styles.name} title={name}>
          {name}
        </span>
      )}
      {origin && <span className={styles.source}>{t(origin)}</span>}
      {item.alreadyAdded ? (
        <span className={styles.already}>{t("addApps.detected.already")}</span>
      ) : item.ignored ? null : (
        <select
          className={`${styles.select} ${styles.pill}`}
          value={category}
          aria-label={t("addApps.row.category", { name })}
          onChange={(e) => onCategory(item.key, e.target.value)}
          onClick={(e) => e.stopPropagation()}
        >
          {CATEGORY_IDS.map((id) => (
            <option key={id} value={id}>
              {t(CATEGORY_LABELS[id])}
            </option>
          ))}
        </select>
      )}
      {onIgnore && !item.alreadyAdded && (
        <button
          type="button"
          className={extra.ignore}
          aria-label={t(item.ignored ? "addApps.row.unignore" : "addApps.row.ignore", { name })}
          title={t(item.ignored ? "addApps.row.unignore" : "addApps.row.ignore", { name })}
          onClick={(e) => {
            e.stopPropagation();
            onIgnore(item.key, !item.ignored);
          }}
        >
          {item.ignored ? t("addApps.row.unignoreShort") : t("addApps.row.ignoreShort")}
        </button>
      )}
    </li>
  );
}
