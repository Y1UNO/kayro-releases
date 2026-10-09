import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { APP_NAME } from "./app/appName";
import styles from "./App.module.css";

export function App() {
  const [pong, setPong] = useState<string>("…");

  useEffect(() => {
    invoke<string>("ping")
      .then(setPong)
      .catch(() => setPong("indisponible"));
    // Show the (hidden) window only once the first frame is painted: no white flash.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void invoke("app_ready");
      }),
    );
  }, []);

  return (
    <main className={styles.main}>
      <h1>{APP_NAME}</h1>
      <p>Squelette de l’étape 2 — IPC : {pong}</p>
    </main>
  );
}
