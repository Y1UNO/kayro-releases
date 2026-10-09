import { useEffect } from "react";
import { IconButton, CloseIcon, Surface } from "../../design";
import { t } from "../../i18n";
import { errorText } from "../../ipc/errors";
import { useHub } from "../../store";
import styles from "./LaunchToast.module.css";

const VISIBLE_MS = 8000;

/** Shows the last refused operation (a launch that failed, a save that was rolled back). */
export function LaunchToast() {
  const error = useHub((s) => s.lastError);
  const clear = useHub((s) => s.clearError);

  // The timer exists only while a message is shown.
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(clear, VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [error, clear]);

  if (!error) return null;
  return (
    <Surface flat radius="var(--radius-xl)" className={styles.toast} role="alert">
      <p className={styles.text}>{errorText(error)}</p>
      <IconButton label={t("home.error.close")} size="sm" onClick={clear}>
        <CloseIcon size={16} />
      </IconButton>
    </Surface>
  );
}
