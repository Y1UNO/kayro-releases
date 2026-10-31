import type { AppEntry } from "../../ipc/bindings";
import { monogram } from "../home/cardLook";
import { useAppIcon } from "../home/useAppIcon";
import styles from "./IslandRest.module.css";

/** Step 20 (Kysland): an app's icon in a small round (its first letter when it has none). */
export function AppMark({ app, size }: { app: AppEntry; size: number }) {
  const icon = useAppIcon(app);
  return (
    <span className={styles.mark} style={{ width: size, height: size }} aria-hidden="true">
      {icon ? <img src={icon} alt={""} draggable={false} /> : monogram(app.name)}
    </span>
  );
}
