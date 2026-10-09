import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, UploadIcon } from "../../design";
import { t } from "../../i18n";
import type { MessageKey } from "../../i18n";
import type { SourceKind } from "../../ipc/bindings";
import { detect } from "../../ipc/commands";
import { itemFromDetected, type ItemList } from "./items";
import { ItemPanel } from "./ItemPanel";
import type { FileDrop } from "./useFileDrop";
import styles from "./AddApps.module.css";

type Status = "scanning" | "done" | "failed";
type Filter = "all" | SourceKind;

const SOURCE_ORDER: readonly SourceKind[] = ["steam", "epic", "startmenu"];
const FILTER_LABELS: Record<SourceKind, MessageKey> = {
  steam: "addApps.detected.steam",
  epic: "addApps.detected.epic",
  startmenu: "addApps.detected.startmenu",
};

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
      replaceAll(
        result.value.sources.flatMap((s) => s.apps.map((app) => itemFromDetected(app, s.source))),
      );
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

/** Apps found on this PC (Steam, Epic, Start Menu): tick the ones to add. */
export function DetectedTab({ list, drop, onAdded, onCancel }: Props) {
  const { status, rescan } = useScan(list);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const by: Record<SourceKind, number> = { steam: 0, epic: 0, startmenu: 0 };
    for (const item of list.items) if (item.origin !== "drop") by[item.origin] += 1;
    return by;
  }, [list.items]);
  const visible = useMemo(
    () => (filter === "all" ? list.items : list.items.filter((i) => i.origin === filter)),
    [list.items, filter],
  );

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

  const filters = (
    <div className={styles.filters} role="group" aria-label={t("addApps.detected.filterLabel")}>
      <Chip className={styles.chip} selected={filter === "all"} onClick={() => setFilter("all")}>
        {t("addApps.detected.all", { count: list.items.length })}
      </Chip>
      {SOURCE_ORDER.filter((s) => counts[s] > 0).map((source) => (
        <Chip
          key={source}
          className={styles.chip}
          selected={filter === source}
          onClick={() => setFilter(source)}
        >
          {t(FILTER_LABELS[source], { count: counts[source] })}
        </Chip>
      ))}
    </div>
  );

  return (
    <ItemPanel
      list={list}
      visible={visible}
      label={t("addApps.detected.listLabel")}
      header={filters}
      empty={<div className={styles.centered}>{t("addApps.detected.empty")}</div>}
      addAll
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
