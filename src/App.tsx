import { useEffect } from "react";
import { APP_NAME } from "./app/appName";
import styles from "./App.module.css";
import { t } from "./i18n";
import { ipc } from "./ipc/commands";
import { errorText } from "./ipc/errors";
import { useHub } from "./store";

export function App() {
  const status = useHub((s) => s.status);
  const appCount = useHub((s) => s.apps.length);
  const error = useHub((s) => s.lastError);

  useEffect(() => {
    // Show the (hidden) window only once the first frame is painted: no white flash.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void ipc.appReady();
      }),
    );
  }, []);

  return (
    <main className={styles.main}>
      <h1>{APP_NAME}</h1>
      {status === "ready" && <p>{t("app.appsCount", { count: appCount })}</p>}
      {status === "failed" && <p>{error ? errorText(error) : t("app.loadFailed")}</p>}
      {status !== "ready" && status !== "failed" && <p>{t("app.loading")}</p>}
    </main>
  );
}
