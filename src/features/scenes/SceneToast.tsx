import { useEffect } from "react";
import { CloseIcon, IconButton, Surface } from "../../design";
import { t } from "../../i18n";
import { errorText } from "../../ipc/errors";
import { useScenes } from "../../store";
import styles from "../home/LaunchToast.module.css";

const VISIBLE_MS = 8000;

/** Last refused scene operation (a scene already running, a refused file…). */
export function SceneToast() {
  const error = useScenes((s) => s.lastError);
  const clear = useScenes((s) => s.clearError);

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
