import { playSound } from "../../sound";
import { useState } from "react";
import { APP_VERSION } from "../../app/appName";
import { Button } from "../../design";
import { t } from "../../i18n";
import { desktopIpc } from "../../ipc/commands";
import { errorText } from "../../ipc/errors";
import { hubStore, useDesktop, useHub } from "../../store";
import { HotkeyField } from "../scenes/HotkeyField";
import { UpdateRows } from "../update/UpdateRows";
import type { OpeningScreen } from "../../ipc/bindings";
import { ChoiceRow, ToggleRow } from "./SettingRow";
import styles from "./Settings.module.css";

/** « Écran d'ouverture » (step 15), in the segments' order. */
const OPENING_SCREENS: readonly OpeningScreen[] = ["last", "pointer", "main"];

/**
 * Réglages › Général: the global shortcut, the opening screen, hiding, economy mode, updates, logs
 * (starting with Windows: Réglages › Démarrage, step 19).
 */
export function GeneralSection() {
  const settings = useHub((s) => s.settings);
  const scenes = useDesktop((s) => s.hotkeys?.scenes);
  const toggleStatus = useDesktop((s) => s.hotkeys?.toggle ?? null);
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [logs, setLogs] = useState<{ text: string; kind: "ok" | "error" } | null>(null);

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

  async function exportLogs() {
    const result = await desktopIpc.exportLogs();
    if (!result.ok) {
      setLogs({ text: t("settings.general.logs.failed"), kind: "error" });
      return;
    }
    playSound("export");
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
      <ChoiceRow<OpeningScreen>
        label={t("settings.general.openingScreen.label")}
        help={t("settings.general.openingScreen.help")}
        value={settings.openingScreen}
        onChange={(openingScreen) => void set({ openingScreen })}
        options={OPENING_SCREENS.map((v) => ({
          value: v,
          label: t(`settings.general.openingScreen.${v}`),
        }))}
      />
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
      <UpdateRows />
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
