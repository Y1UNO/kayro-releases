import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, UploadIcon } from "../../design";
import { t } from "../../i18n";
import { detect } from "../../ipc/commands";
import { hubStore } from "../../store";
import { CATEGORY_IDS, CATEGORY_LABELS } from "../home/categories";
import { normalize } from "../home/search";
import { itemFromDetected, picksByDefault, type Item, type ItemList } from "./items";
import { ItemPanel, type ItemGroup } from "./ItemPanel";
import type { FileDrop } from "./useFileDrop";
import styles from "./AddApps.module.css";
import extra from "./Detected.module.css";

type Status = "scanning" | "done" | "failed";
/** Step 19b: the new apps (default), the ones already added, the ignored ones. */
type View = "new" | "added" | "ignored";

function viewOf(i: Item): View {
  return i.alreadyAdded ? "added" : i.ignored ? "ignored" : "new";
}

/** By category in the home screen's order, stores and launchers last and folded. */
export function groupItems(items: readonly Item[]): ItemGroup[] {
  const groups: ItemGroup[] = CATEGORY_IDS.map((id) => ({
    key: id,
    label: t(CATEGORY_LABELS[id]),
    items: items.filter((i) => !i.launcher && i.category === id),
  }));
  groups.push({
    key: "launchers",
    label: t("addApps.detected.launchers"),
    items: items.filter((i) => i.launcher),
    folded: true,
  });
  return groups.filter((g) => g.items.length > 0);
}

/** « Ignorer » is kept in the settings: the next scans mark the app as ignored. */
function rememberIgnored(id: string, ignored: boolean) {
  const { settings, setSettings } = hubStore.getState();
  const current = settings?.ignoredDetections ?? [];
  const next = ignored ? [...new Set([...current, id])] : current.filter((x) => x !== id);
  void setSettings({ ignoredDetections: next });
}

/**
 * Runs the scan when the dialog opens (never on the interface thread: the core does the work).
 *
 * The core cancels a scan when another one starts, and `detect_cancel` is a separate request that
 * can overtake it. So the cancel on closing is sent a moment later and dropped if the effect runs
 * again at once (React's development double-run), and a report that comes back cancelled while it
 * is still the wanted one is asked for again.
 */
function useScan(list: ItemList) {
  const [status, setStatus] = useState<Status>("scanning");
  const run = useRef(0);
  const cancelTimer = useRef(0);
  const { replaceAll } = list;

  const scan = useCallback(async () => {
    const id = (run.current += 1);
    setStatus("scanning");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await detect.scan();
      if (id !== run.current) return; // a newer scan took over, or the dialog closed
      if (!result.ok) {
        setStatus("failed");
        return;
      }
      if (result.value.cancelled && attempt === 0) continue;
      const items = result.value.sources.flatMap((s) =>
        s.apps.map((app) => itemFromDetected(app, s.source)),
      );
      replaceAll(items, picksByDefault(items));
      setStatus("done");
      return;
    }
  }, [replaceAll]);

  useEffect(() => {
    window.clearTimeout(cancelTimer.current);
    // The scan is an external system: its result arrives later, after this effect has run.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the request, no sync render loop
    void scan();
    return () => {
      run.current += 1;
      cancelTimer.current = window.setTimeout(() => void detect.cancel(), 50);
    };
  }, [scan]);

  return { status, rescan: scan };
}

interface Props {
  list: ItemList;
  drop: FileDrop;
  onAdded: (count: number) => void;
  onCancel: () => void;
}

/**
 * Apps found on this PC (Steam, Epic, Start Menu), step 19b: the new ones by category with their
 * logo, the sure ones already ticked, a search, stores and launchers apart, « Ignorer » remembered.
 */
export function DetectedTab({ list, drop, onAdded, onCancel }: Props) {
  const { status, rescan } = useScan(list);
  const [view, setView] = useState<View>("new");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const by: Record<View, number> = { new: 0, added: 0, ignored: 0 };
    for (const item of list.items) by[viewOf(item)] += 1;
    return by;
  }, [list.items]);
  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return list.items.filter(
      (i) => viewOf(i) === view && (!q || normalize(i.name).includes(q)),
    );
  }, [list.items, view, query]);
  const groups = useMemo(() => groupItems(visible), [visible]);

  if (status === "scanning") {
    return (
      <div className={styles.centered} role="status">
        {t("addApps.detected.scanning")}
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className={styles.centered} role="alert">
        {t("addApps.detected.failed")}
        <Button onClick={() => void rescan()}>{t("addApps.detected.retry")}</Button>
      </div>
    );
  }

  const ignore = (key: string, ignored: boolean) => {
    list.setIgnored(key, ignored);
    rememberIgnored(key, ignored);
  };

  const header = (
    <div className={extra.detectBar}>
      <input
        className={`${styles.input} ${extra.search}`}
        type="search"
        value={query}
        placeholder={t("addApps.detected.search")}
        aria-label={t("addApps.detected.search")}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.filters} role="group" aria-label={t("addApps.detected.viewLabel")}>
        {(["new", "added", "ignored"] as const)
          .filter((v) => v === "new" || counts[v] > 0)
          .map((v) => (
            <Chip
              key={v}
              className={styles.chip}
              selected={view === v}
              onClick={() => setView(v)}
            >
              {t(
                v === "new"
                  ? "addApps.detected.viewNew"
                  : v === "added"
                    ? "addApps.detected.viewAdded"
                    : "addApps.detected.viewIgnored",
                { count: counts[v] },
              )}
            </Chip>
          ))}
      </div>
    </div>
  );

  const empty = query.trim()
    ? t("addApps.detected.emptySearch", { query: query.trim() })
    : view === "new"
      ? t("addApps.detected.emptyNew")
      : t("addApps.detected.empty");

  return (
    <ItemPanel
      list={list}
      visible={visible}
      groups={groups}
      label={view === "new" && list.chosen.length > 0 ? t("addApps.detected.picked") : t("addApps.detected.listLabel")}
      header={header}
      empty={<div className={styles.centered}>{empty}</div>}
      addAll
      onIgnore={ignore}
      beforeFooter={
        <div
          className={`${styles.zone} ${styles.zoneSmall}`}
          data-hover={drop.hovering || undefined}
        >
          <UploadIcon size={18} />
          {drop.hovering ? t("addApps.drop.zoneActive") : t("addApps.drop.zone")}
        </div>
      }
      onAdded={onAdded}
      onCancel={onCancel}
    />
  );
}
