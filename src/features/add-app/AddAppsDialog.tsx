import { Dialog } from "../../design";
import { t } from "../../i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Placeholder: the real dialog (detected apps, drag and drop, manual entry) is step 9. */
export function AddAppsDialog({ open, onClose }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("home.addApps.title")}
      closeLabel={t("home.addApps.close")}
    >
      <p>{t("home.addApps.soon")}</p>
    </Dialog>
  );
}
