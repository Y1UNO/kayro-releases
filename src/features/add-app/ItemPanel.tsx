import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../design";
import { t } from "../../i18n";
import { errorText } from "../../ipc/errors";
import { hubStore } from "../../store";
import { categoryOf } from "../home/categories";
import { toNewApp, type Item, type ItemList } from "./items";
import { ItemRow } from "./ItemRow";
import styles from "./AddApps.module.css";
import extra from "./Detected.module.css";

/** A part of the list with its title (19b: the detected apps by category). */
export interface ItemGroup {
  key: string;
  label: string;
  items: readonly Item[];
  /** Closed until the user opens it (stores and launchers). */
  folded?: boolean;
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
  /** The rows in titled parts instead of one list (19b). */
  groups?: readonly ItemGroup[];
  /** « Ignorer » on each row (detected apps). */
  onIgnore?: (key: string, ignored: boolean) => void;
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
  groups,
  onIgnore,
  beforeFooter,
  onAdded,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState<Status>(null);

  const addable = visible.filter((i) => !i.alreadyAdded && !i.ignored);
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

  const row = (item: Item) => (
    <ItemRow
      key={item.key}
      item={item}
      checked={list.selected.has(item.key)}
      name={list.edits[item.key]?.name ?? item.name}
      category={list.edits[item.key]?.category ?? item.category}
      editableName={editableNames}
      onToggle={list.toggle}
      onName={list.setName}
      onCategory={(key, value) => list.setCategory(key, categoryOf({ category: value }))}
      onIgnore={onIgnore}
    />
  );

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
      ) : groups ? (
        <div className={styles.list} aria-label={label} role="group">
          {groups.map((g) => {
            const open = !g.folded || opened.has(g.key);
            return (
              <section key={g.key} className={extra.group}>
                <button
                  type="button"
                  className={extra.groupHead}
                  aria-expanded={open}
                  onClick={() =>
                    setOpened((s) => {
                      const next = new Set(s);
                      if (!next.delete(g.key)) next.add(g.key);
                      return next;
                    })
                  }
                  disabled={!g.folded}
                >
                  <span>{g.label}</span>
                  <span className={extra.groupCount}>{g.items.length}</span>
                </button>
                {open && <ul className={extra.groupList}>{g.items.map(row)}</ul>}
              </section>
            );
          })}
        </div>
      ) : (
        <ul className={styles.list} aria-label={label}>
          {visible.map(row)}
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
