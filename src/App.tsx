import { useEffect } from "react";
import styles from "./App.module.css";
import { HomeScreen } from "./features/home/HomeScreen";
import { t } from "./i18n";
import { ipc } from "./ipc/commands";
import { errorText } from "./ipc/errors";
import { useHub } from "./store";

export function App() {
  const status = useHub((s) => s.status);
  const error = useHub((s) => s.lastError);

  useEffect(() => {
    // Show the (hidden) window only once the first frame is painted: no white flash.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void ipc.appReady();
      }),
    );
  }, []);

  if (status === "ready") return <HomeScreen />;
  return (
    <main className={styles.main}>
      {status === "failed" ? (
        <p>{error ? errorText(error) : t("app.loadFailed")}</p>
      ) : (
        <p>{t("app.loading")}</p>
      )}
    </main>
  );
}
