import { useCallback, useState } from "react";
import { Dialog, SegmentedControl } from "../../design";
import { t } from "../../i18n";
import type { Refused } from "../../ipc/bindings";
import { ipc } from "../../ipc/commands";
import { hubStore } from "../../store";
import { EMPTY_DRAFT, draftToNewApp } from "./draft";
import { DetectedTab } from "./DetectedTab";
import { DropTab } from "./DropTab";
import { itemFromCandidate, useItemList } from "./items";
import { ManualForm } from "./ManualForm";
import { refusalOf } from "./refusal";
import { useFileDrop } from "./useFileDrop";
import styles from "./AddApps.module.css";

type Tab = "detected" | "drop" | "manual";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the number of apps that were added, when the dialog closes after adding. */
  onAdded?: (count: number) => void;
}

/**
 * "Ajouter des applications": detected apps, drag and drop, manual entry. Nothing is started
 * here; every app goes through the core's validation again when it is added.
 */
export function AddAppsDialog({ open, onClose, onAdded }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="wide"
      title={t("home.addApps.title")}
      closeLabel={t("home.addApps.close")}
    >
      <Body onClose={onClose} onAdded={onAdded} />
    </Dialog>
  );
}

function Body({ onClose, onAdded }: Omit<Props, "open">) {
  const [tab, setTab] = useState<Tab>("detected");
  const [manualDone, setManualDone] = useState<string | null>(null);
  const [refused, setRefused] = useState<readonly Refused[]>([]);
  const detected = useItemList();
  const dropped = useItemList();
  const { append } = dropped;

  const inspect = useCallback(
    async (inputs: string[]) => {
      setTab("drop");
      const result = await ipc.appsInspect(inputs);
      if (!result.ok) return;
      append(result.value.candidates.map(itemFromCandidate));
      setRefused(result.value.refused);
    },
    [append],
  );
  const drop = useFileDrop((paths) => void inspect(paths));

  const added = (count: number) => {
    onAdded?.(count);
    onClose();
  };

  return (
    <div className={styles.body}>
      <SegmentedControl
        label={t("addApps.tabsLabel")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "detected", label: t("addApps.tabs.detected") },
          { value: "drop", label: t("addApps.tabs.drop") },
          { value: "manual", label: t("addApps.tabs.manual") },
        ]}
      />
      {/* All three stay mounted: the scan result and a dropped list survive a tab change. */}
      <div className={styles.panel} hidden={tab !== "detected"}>
        <DetectedTab list={detected} drop={drop} onAdded={added} onCancel={onClose} />
      </div>
      <div className={styles.panel} hidden={tab !== "drop"}>
        <DropTab
          list={dropped}
          drop={drop}
          refused={refused}
          onInspect={(inputs) => void inspect(inputs)}
          onAdded={added}
          onCancel={onClose}
        />
      </div>
      <div className={styles.panel} hidden={tab !== "manual"}>
        <ManualForm
          initial={EMPTY_DRAFT}
          submitLabel={t("addApps.manual.submit")}
          resetOnSuccess
          successText={manualDone}
          extra={null}
          onSubmit={async (draft) => {
            setManualDone(null);
            const result = await hubStore.getState().addApp(draftToNewApp(draft));
            if (!result.ok) {
              hubStore.getState().clearError();
              return refusalOf(result.error);
            }
            setManualDone(t("addApps.manual.added", { name: result.value.name }));
            return null;
          }}
        />
      </div>
    </div>
  );
}
