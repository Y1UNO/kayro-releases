import type { ReactNode } from "react";
import { Button, Dialog } from "../../design";
import { t } from "../../i18n";
import styles from "./Editor.module.css";

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** A third choice (« Enregistrer » next to « Abandonner »), shown first. */
  extra?: { label: string; onClick: () => void };
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small question with two (or three) answers. Escape and the close button answer « cancel ». */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  extra,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} closeLabel={t("scenes.close")}>
      <div className={styles.confirmBody}>{children}</div>
      <div className={styles.confirmActions}>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        {extra && <Button onClick={extra.onClick}>{extra.label}</Button>}
        <Button variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
