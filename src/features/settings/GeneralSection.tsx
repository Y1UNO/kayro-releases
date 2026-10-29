import { useEffect, useState } from "react";
import { APP_VERSION } from "../../app/appName";
import { Button } from "../../design";
import { t } from "../../i18n";
import { desktopIpc } from "../../ipc/commands";
import { errorText } from "../../ipc/errors";
import { hubStore, useDesktop, useHub } from "../../store";
import { HotkeyField } from "../scenes/HotkeyField";
import { ToggleRow } from "./SettingRow";
import styles from "./Settings.module.css";

/** Réglages › Général: the global shortcut, hiding, economy mode, starting with Windows, logs. */
export function GeneralSection() {
  const settings = useHub((s) => s.settings);
  const scenes = useDesktop((s) => s.hotkeys?.scenes);
  const toggleStatus = useDesktop((s) => s.hotkeys?.toggle ?? null);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [logs, setLogs] = useState<{ text: string; kind: "ok" | "error" } | null>(null);

  // What lives outside settings.json is read each time the section shows.
  useEffect(() => {
    let live = true;
    void desktopIpc.autostart().then((r) => live && setAutostart(r.ok ? r.value : null));
    return () => {
      live = false;
    };
  }, []);

  if (!settings) return null;
  const set = hubStore.getState().setSettings;

  async function changeHotkey(hotkey: string | null) {
    if (!hotkey) return; // the shortcut cannot be removed, only replaced
    const result = await desktopIpc.setHotkey(hotkey);
    setMessage(
      result.ok
        ? { text: t("settings.general.hotkey.saved"), kind: "ok" }
        : { text: errorText(result.error), kind: "error" },
    );
  }

  async function changeAutostart(enabled: boolean) {
    const result = await desktopIpc.setAutostart(enabled);
    if (result.ok) setAutostart(result.value);
    else setMessage({ text: t("settings.general.autostart.failed"), kind: "error" });
  }

  async function exportLogs() {
    const result = await desktopIpc.exportLogs();
    if (!result.ok) {
      setLogs({ text: t("settings.general.logs.failed"), kind: "error" });
      return;
    }
    const file = result.value.split(/[\\/]/).pop() ?? result.value;
    setLogs({ text: t("settings.general.logs.done", { file }), kind: "ok" });
  }

  return (
    <div className={styles.rows} data-cascade="">
      <section className={styles.row} data-row="">
        <h3 className={styles.label}>{t("settings.general.hotkey.label")}</h3>
        <HotkeyField
          value={settings.hotkey}
          taken={scenes?.map((s) => s.hotkey) ?? []}
          onChange={(hotkey) => void changeHotkey(hotkey)}
        />
        {toggleStatus?.problem != null && (
          <p className={styles.warn} role="status">
            {t("settings.general.hotkey.failedAtStart", { hotkey: settings.hotkey })}
          </p>
        )}
        {message && (
          <p className={message.kind === "error" ? styles.warn : styles.help} role="status">
            {message.text}
          </p>
        )}
      </section>
      <ToggleRow
        label={t("settings.general.hideOnEscape")}
        checked={settings.hideOnEscape}
        onChange={(hideOnEscape) => void set({ hideOnEscape })}
      />
      <ToggleRow
        label={t("settings.general.hideOnBlur")}
        checked={settings.hideOnBlur}
        onChange={(hideOnBlur) => void set({ hideOnBlur })}
      />
      <ToggleRow
        label={t("settings.general.economy.label")}
        help={t("settings.general.economy.help")}
        checked={settings.economyMode}
        onChange={(economyMode) => void set({ economyMode })}
      />
      <ToggleRow
        label={t("settings.general.autostart.label")}
        help={t("settings.general.autostart.help")}
        checked={autostart === true}
        disabled={autostart === null}
        onChange={(enabled) => void changeAutostart(enabled)}
      />
      <section className={styles.row} data-row="">
        <h3 className={styles.label}>{t("settings.general.logs.label")}</h3>
        <p className={styles.help}>{t("settings.general.logs.help")}</p>
        <div className={styles.resetRow}>
          <Button size="sm" onClick={() => void exportLogs()}>
            {t("settings.general.logs.action")}
          </Button>
        </div>
        {logs && (
          <p className={logs.kind === "error" ? styles.warn : styles.help} role="status">
            {logs.text}
          </p>
        )}
      </section>
      <p className={styles.help}>{t("settings.general.version", { version: APP_VERSION })}</p>
    </div>
  );
}
