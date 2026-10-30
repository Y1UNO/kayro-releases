import { useEffect, useState } from "react";
import { Button } from "../../design";
import { t } from "../../i18n";
import type { StartupApp } from "../../ipc/bindings";
import { desktopIpc } from "../../ipc/commands";
import { hubStore, useHub } from "../../store";
import { ChoiceRow, ToggleRow } from "./SettingRow";
import styles from "./Settings.module.css";

type Screen = "home" | "quiet";
type Status = { text: string; kind: "ok" | "error" } | null;

/**
 * Réglages › Démarrage (step 19): Kayro with Windows (on its home screen or quietly), the other
 * apps Windows starts at login — switched on and off like the Task Manager does — and « Tout
 * remettre comme avant » for what Kayro switched off. Windows', the drivers' and the whole PC's
 * entries are only named, never changed.
 */
export function StartupSection() {
  const settings = useHub((s) => s.settings);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [apps, setApps] = useState<StartupApp[] | null>(null);
  const [status, setStatus] = useState<Status>(null);

  // What lives outside settings.json is read each time the section shows.
  useEffect(() => {
    let live = true;
    void desktopIpc.autostart().then((r) => live && setAutostart(r.ok ? r.value : null));
    void desktopIpc.startupApps().then((r) => live && setApps(r.ok ? r.value : []));
    return () => {
      live = false;
    };
  }, []);

  if (!settings) return null;

  async function changeAutostart(enabled: boolean) {
    const result = await desktopIpc.setAutostart(enabled);
    if (result.ok) setAutostart(result.value);
    else setStatus({ text: t("settings.startup.autostart.failed"), kind: "error" });
  }

  async function switchApp(id: string, enabled: boolean) {
    const result = await desktopIpc.setStartupApp(id, enabled);
    if (result.ok) setApps(result.value);
    else setStatus({ text: t("settings.startup.apps.failed"), kind: "error" });
  }

  async function restore() {
    const result = await desktopIpc.restoreStartupApps();
    if (!result.ok) return setStatus({ text: t("settings.startup.apps.failed"), kind: "error" });
    setApps(result.value);
    setStatus({ text: t("settings.startup.restore.done"), kind: "ok" });
  }

  const own = apps?.filter((a) => !a.locked) ?? [];
  const locked = apps?.filter((a) => a.locked && a.locked !== "kayro") ?? [];
  const byKayro = own.some((a) => a.byKayro);

  return (
    <div className={styles.rows} data-cascade="">
      <ToggleRow
        label={t("settings.startup.autostart.label")}
        help={t("settings.startup.autostart.help")}
        checked={autostart === true}
        disabled={autostart === null}
        onChange={(enabled) => void changeAutostart(enabled)}
      />
      {autostart && (
        <ChoiceRow<Screen>
          label={t("settings.startup.screen.label")}
          help={t("settings.startup.screen.help")}
          value={settings.startupHome ? "home" : "quiet"}
          onChange={(v) => void hubStore.getState().setSettings({ startupHome: v === "home" })}
          options={(["home", "quiet"] as const).map((v) => ({
            value: v,
            label: t(`settings.startup.screen.${v}`),
          }))}
        />
      )}
      <section className={styles.row} data-row="">
        <h3 className={styles.label}>{t("settings.startup.apps.label")}</h3>
        <p className={styles.help}>{t("settings.startup.apps.help")}</p>
        {apps !== null && own.length === 0 && (
          <p className={styles.help}>{t("settings.startup.apps.none")}</p>
        )}
      </section>
      {own.map((a) => (
        <ToggleRow
          key={a.id}
          label={a.name}
          help={a.byKayro ? t("settings.startup.apps.byKayro") : undefined}
          checked={a.enabled}
          onChange={(on) => void switchApp(a.id, on)}
        />
      ))}
      {locked.length > 0 && (
        <p className={styles.help}>
          {t("settings.startup.apps.locked", { names: locked.map((a) => a.name).join(", ") })}
        </p>
      )}
      <section className={styles.row} data-row="">
        <h3 className={styles.label}>{t("settings.startup.restore.label")}</h3>
        <p className={styles.help}>
          {byKayro ? t("settings.startup.restore.help") : t("settings.startup.restore.nothing")}
        </p>
        <div className={styles.resetRow}>
          <Button size="sm" disabled={!byKayro} onClick={() => void restore()}>
            {t("settings.startup.restore.label")}
          </Button>
        </div>
        {status && (
          <p className={status.kind === "error" ? styles.warn : styles.help} role="status">
            {status.text}
          </p>
        )}
      </section>
    </div>
  );
}
