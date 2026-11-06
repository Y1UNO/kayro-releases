import { useEffect, useRef, useState } from "react";
import { Button } from "../../design";
import { t } from "../../i18n";
import type { ScanReport } from "../../ipc/bindings";
import { detect } from "../../ipc/commands";
import { onDeepProgress } from "../../ipc/events";
import styles from "./DeepScan.module.css";

interface Props {
  /** What the advanced scan found (the usual sources and its own). */
  onDone: (report: ScanReport) => void;
  onClose: () => void;
}

/** The bar fills towards the end without knowing the number of folders: 1 500 read ≈ half. */
function fillOf(folders: number, logos: boolean): number {
  const apps = folders / (folders + 1500);
  return logos ? 0.85 + 0.1 * apps : 0.85 * apps;
}

/**
 * Step 19c, « Scan avancé »: first what it does (the user starts it), then a bar in Kayro's light —
 * a lavender → peach fill with a glowing head and a sheen running along it (transform only;
 * still with reduced motion) — the folders read and the apps found.
 */
export function DeepScan({ onDone, onClose }: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ folders: 0, found: 0, logos: false });
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const off = onDeepProgress((p) => live.current && setProgress(p));
    void detect.deep().then((r) => {
      if (!live.current) return;
      if (r.ok) onDone(r.value);
      else onClose();
    });
    return () => void off.then((stop) => stop());
    // Started once: the scan is the external system.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  if (!running) {
    return (
      <div className={styles.panel} role="dialog" aria-label={t("addApps.detected.deepTitle")}>
        <h3 className={styles.title}>{t("addApps.detected.deepTitle")}</h3>
        <p className={styles.text}>{t("addApps.detected.deepText")}</p>
        <div className={styles.actions}>
          <Button onClick={onClose}>{t("addApps.detected.deepCancel")}</Button>
          <Button variant="primary" onClick={() => setRunning(true)}>
            {t("addApps.detected.deepGo")}
          </Button>
        </div>
      </div>
    );
  }

  const fill = fillOf(progress.folders, progress.logos);
  return (
    <div className={styles.panel} role="status" aria-live="polite">
      <h3 className={styles.title}>{t("addApps.detected.deepRunning")}</h3>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ transform: `scaleX(${fill.toFixed(3)})` }} />
        <div className={styles.head} style={{ transform: `translateX(${(fill * 100).toFixed(1)}cqw)` }} />
        <div className={styles.sheen} />
      </div>
      <p className={styles.text}>
        {progress.logos
          ? t("addApps.detected.deepLogos")
          : t("addApps.detected.deepCount", { folders: progress.folders, found: progress.found })}
      </p>
      <div className={styles.actions}>
        <Button
          onClick={() => {
            void detect.cancel();
          }}
        >
          {t("addApps.detected.deepStop")}
        </Button>
      </div>
    </div>
  );
}
