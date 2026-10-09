import { useState } from "react";
import type { FormEvent } from "react";
import { Button, UploadIcon } from "../../design";
import { t } from "../../i18n";
import type { MessageKey } from "../../i18n";
import type { RejectReason, Refused } from "../../ipc/bindings";
import type { FileDrop } from "./useFileDrop";
import type { ItemList } from "./items";
import { ItemPanel } from "./ItemPanel";
import styles from "./AddApps.module.css";

const REASON_LABELS: Record<RejectReason, MessageKey> = {
  notFound: "addApps.drop.reasons.notFound",
  notSupported: "addApps.drop.reasons.notSupported",
  invalid: "addApps.drop.reasons.invalid",
  repeated: "addApps.drop.reasons.repeated",
  tooMany: "addApps.drop.reasons.tooMany",
};

interface Props {
  list: ItemList;
  drop: FileDrop;
  refused: readonly Refused[];
  /** Files or addresses typed / pasted here (dropped files arrive through the dialog). */
  onInspect: (inputs: string[]) => void;
  onAdded: (count: number) => void;
  onCancel: () => void;
}

/** Files dropped on the window, or an address / path pasted here, become rows to confirm. */
export function DropTab({ list, drop, refused, onInspect, onAdded, onCancel }: Props) {
  const [text, setText] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim() === "") return;
    onInspect([text]);
    setText("");
  }

  const header = (
    <>
      <div className={styles.zone} data-hover={drop.hovering || undefined}>
        <UploadIcon size={18} />
        {drop.hovering ? t("addApps.drop.zoneActive") : t("addApps.drop.zone")}
      </div>
      {!drop.available && <p className={styles.hint}>{t("addApps.drop.browserOnly")}</p>}
      <form className={styles.paste} onSubmit={submit}>
        <input
          className={styles.input}
          value={text}
          placeholder={t("addApps.drop.pastePlaceholder")}
          aria-label={t("addApps.drop.pasteLabel")}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" disabled={text.trim() === ""}>
          {t("addApps.drop.pasteButton")}
        </Button>
      </form>
    </>
  );

  const refusedList = refused.length > 0 && (
    <div>
      <p className={styles.label}>{t("addApps.drop.refusedTitle")}</p>
      <ul className={styles.refused}>
        {refused.map((r, i) => (
          <li key={`${r.input}-${i}`}>
            <b>{r.input}</b> <span className={styles.reason}>{t(REASON_LABELS[r.reason])}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <ItemPanel
      list={list}
      visible={list.items}
      label={t("addApps.drop.listLabel")}
      editableNames
      header={header}
      empty={<div className={styles.centered} />}
      beforeFooter={refusedList}
      onAdded={onAdded}
      onCancel={onCancel}
    />
  );
}
