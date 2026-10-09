import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../design";
import { t } from "../../i18n";
import { errorText } from "../../ipc/errors";
import { hubStore } from "../../store";
import { CATEGORY_IDS, CATEGORY_LABELS, categoryOf } from "../home/categories";
import { monogram } from "../home/cardLook";
import { toNewApp, type Item, type ItemList, type Origin } from "./items";
import styles from "./AddApps.module.css";

const ORIGIN_LABELS = {
  steam: "addApps.detected.sourceSteam",
  epic: "addApps.detected.sourceEpic",
  startmenu: "addApps.detected.sourceStartmenu",
  drop: null,
} as const satisfies Record<Origin, string | null>;

interface RowProps {
  item: Item;
  checked: boolean;
  name: string;
  category: string;
  editableName: boolean;
  onToggle: (key: string) => void;
  onName: (key: string, name: string) => void;
  onCategory: (key: string, category: string) => void;
}

/** One proposed app: checkbox, monogram, name, source, category. A click anywhere selects. */
function Row({
  item,
  checked,
  name,
  category,
  editableName,
  onToggle,
  onName,
  onCategory,
}: RowProps) {
  const origin = ORIGIN_LABELS[item.origin];
  const locked = item.alreadyAdded;
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
      <span className={styles.tile} aria-hidden="true">
        {monogram(name)}
      </span>
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
      {locked ? (
        <span className={styles.already}>{t("addApps.detected.already")}</span>
      ) : (
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
    </li>
  );
}

interface Props {
  list: ItemList;
  /** The rows to show (the list may be filtered). */
  visible: readonly Item[];
  label: string;
  editableNames?: boolean;
  /** Filters, drop zone… shown above the rows. */
  header?: ReactNode;
  /** Shown instead of the rows when `visible` is empty. */
  empty: ReactNode;
  /** Shown between the rows and the footer (what was refused…). */
  beforeFooter?: ReactNode;
  /** Lets "Tout ajouter" send every addable visible row at once. */
  addAll?: boolean;
  onAdded: (count: number) => void;
  onCancel: () => void;
}

type Status = { tone: "ok" | "error"; text: string } | null;

/** The rows of a list of proposed apps, with "select all", the selection count and the footer. */
export function ItemPanel({
  list,
  visible,
  label,
  editableNames = false,
  header,
  empty,
  addAll = false,
  beforeFooter,
  onAdded,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const addable = visible.filter((i) => !i.alreadyAdded);
  const allSelected = addable.length > 0 && addable.every((i) => list.selected.has(i.key));
  const count = list.chosen.length;

  async function commit(items: readonly Item[]) {
    if (busy || items.length === 0) return;
    setBusy(true);
    setStatus(null);
    const result = await hubStore
      .getState()
      .addApps(items.map((i) => toNewApp(i, list.edits[i.key])));
    setBusy(false);
    if (!result.ok) {
      hubStore.getState().clearError();
      setStatus({ tone: "error", text: errorText(result.error) });
      return;
    }
    const refused = new Set(result.value.failed.map((f) => f.index));
    const done = items.filter((_, index) => !refused.has(index));
    list.markAdded(done.map((i) => i.key));
    if (refused.size === 0) {
      onAdded(done.length);
    } else {
      setStatus({
        tone: "error",
        text: t("addApps.addedPartial", { added: done.length, failed: refused.size }),
      });
    }
  }

  const summary =
    count === 0
      ? t("addApps.selectedNone")
      : count === 1
        ? t("addApps.selectedOne")
        : t("addApps.selectedMany", { count });

  return (
    <>
      {header}
      {visible.length > 0 && (
        <div className={styles.listBar}>
          <span>{label}</span>
          {addable.length > 0 && (
            <button
              type="button"
              className={styles.link}
              onClick={() =>
                list.setMany(
                  addable.map((i) => i.key),
                  !allSelected,
                )
              }
            >
              {allSelected ? t("addApps.selectNone") : t("addApps.selectAll")}
            </button>
          )}
        </div>
      )}
      {visible.length === 0 ? (
        empty
      ) : (
        <ul className={styles.list} aria-label={label}>
          {visible.map((item) => (
            <Row
              key={item.key}
              item={item}
              checked={list.selected.has(item.key)}
              name={list.edits[item.key]?.name ?? item.name}
              category={list.edits[item.key]?.category ?? item.category}
              editableName={editableNames}
              onToggle={list.toggle}
              onName={list.setName}
              onCategory={(key, value) => list.setCategory(key, categoryOf({ category: value }))}
            />
          ))}
        </ul>
      )}
      {beforeFooter}
      <div className={styles.footer}>
        <span className={styles.status} role="status" data-tone={status?.tone}>
          {status?.text ?? summary}
        </span>
        <div className={styles.actions}>
          <Button onClick={onCancel}>{t("addApps.cancel")}</Button>
          {addAll && addable.length > 1 && (
            <Button disabled={busy} onClick={() => void commit(addable)}>
              {t("addApps.addAll", { count: addable.length })}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={busy || count === 0}
            onClick={() => void commit(list.chosen)}
          >
            {t("addApps.add")}
          </Button>
        </div>
      </div>
    </>
  );
}
