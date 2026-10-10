import { useEffect, useId, useState } from "react";
import { Dialog, SegmentedControl, Toggle } from "../../design";
import { t } from "../../i18n";
import type { DisplayMode, MonitorInfo, WidgetStyle } from "../../ipc/bindings";
import { desktopIpc } from "../../ipc/commands";
import { errorText } from "../../ipc/errors";
import { hubStore, useDesktop, useHub } from "../../store";
import { HotkeyField } from "../scenes/HotkeyField";
import styles from "./DisplaySettings.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** « Écran 2 · 2560×1440 » from Windows' `\\.\DISPLAY2`. */
function screenLabel(m: MonitorInfo, index: number): string {
  const n = /DISPLAY(\d+)/i.exec(m.name)?.[1] ?? String(index + 1);
  return t("displaySettings.screen.item", { name: `${n}`, width: m.width, height: m.height });
}

/**
 * Display and shortcut settings: mode, screen of the immersive mode, widget style, the global
 * shortcut, economy mode, hiding, and starting with Windows. A first piece of the settings
 * screen (performance and appearance come in steps 13 and 15).
 */
export function DisplaySettings({ open, onClose }: Props) {
  const settings = useHub((s) => s.settings);
  const scenes = useDesktop((s) => s.hotkeys?.scenes);
  const toggleStatus = useDesktop((s) => s.hotkeys?.toggle ?? null);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "error" } | null>(null);

  // What lives outside settings.json is read each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    let live = true;
    void desktopIpc.monitors().then((r) => live && r.ok && setMonitors(r.value));
    void desktopIpc.autostart().then((r) => live && setAutostart(r.ok ? r.value : null));
    return () => {
      live = false;
    };
  }, [open]);

  if (!settings) return null;
  const set = hubStore.getState().setSettings;

  async function changeHotkey(hotkey: string | null) {
    if (!hotkey) return; // the shortcut cannot be removed, only replaced
    const result = await desktopIpc.setHotkey(hotkey);
    setMessage(
      result.ok
        ? { text: t("displaySettings.hotkey.saved"), kind: "ok" }
        : { text: errorText(result.error), kind: "error" },
    );
  }

  async function changeAutostart(enabled: boolean) {
    const result = await desktopIpc.setAutostart(enabled);
    if (result.ok) setAutostart(result.value);
    else setMessage({ text: t("displaySettings.autostart.failed"), kind: "error" });
  }

  async function chooseScreen(name: string) {
    await desktopIpc.chooseMonitor(name);
    const r = await desktopIpc.monitors();
    if (r.ok) setMonitors(r.value);
  }

  const startupProblem = toggleStatus?.problem != null;
  const chosen = monitors.find((m) => m.chosen) ?? monitors[0];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("displaySettings.title")}
      closeLabel={t("displaySettings.close")}
    >
      <div className={styles.body}>
        <section className={styles.row}>
          <h3 className={styles.label}>{t("displaySettings.mode.label")}</h3>
          <SegmentedControl<DisplayMode>
            label={t("displaySettings.mode.label")}
            value={settings.displayMode}
            onChange={(displayMode) => void set({ displayMode })}
            options={[
              { value: "immersive", label: t("home.modes.immersive") },
              { value: "window", label: t("home.modes.window") },
              { value: "widget", label: t("home.modes.widget") },
            ]}
          />
          <p className={styles.help}>{t("displaySettings.mode.help")}</p>
        </section>

        {monitors.length > 1 && chosen && (
          <section className={styles.row}>
            <h3 className={styles.label}>{t("displaySettings.screen.label")}</h3>
            <SegmentedControl<string>
              label={t("displaySettings.screen.label")}
              size="sm"
              value={chosen.name}
              onChange={(name) => void chooseScreen(name)}
              options={monitors.map((m, i) => ({ value: m.name, label: screenLabel(m, i) }))}
            />
          </section>
        )}

        <section className={styles.row}>
          <h3 className={styles.label}>{t("displaySettings.widgetStyle.label")}</h3>
          <SegmentedControl<WidgetStyle>
            label={t("displaySettings.widgetStyle.label")}
            size="sm"
            value={settings.widgetStyle}
            onChange={(widgetStyle) => void set({ widgetStyle })}
            options={[
              { value: "aurore", label: t("displaySettings.widgetStyle.aurore") },
              { value: "sillage", label: t("displaySettings.widgetStyle.sillage") },
              { value: "brume", label: t("displaySettings.widgetStyle.brume") },
              { value: "orbe", label: t("displaySettings.widgetStyle.orbe") },
            ]}
          />
        </section>

        <section className={styles.row}>
          <h3 className={styles.label}>{t("displaySettings.hotkey.label")}</h3>
          <HotkeyField
            value={settings.hotkey}
            taken={scenes?.map((s) => s.hotkey) ?? []}
            onChange={(hotkey) => void changeHotkey(hotkey)}
          />
          {startupProblem && (
            <p className={styles.warn} role="status">
              {t("displaySettings.hotkey.failedAtStart", { hotkey: settings.hotkey })}
            </p>
          )}
          {message && (
            <p className={message.kind === "error" ? styles.warn : styles.help} role="status">
              {message.text}
            </p>
          )}
        </section>

        <ToggleRow
          label={t("displaySettings.economy.label")}
          help={t("displaySettings.economy.help")}
          checked={settings.economyMode}
          onChange={(economyMode) => void set({ economyMode })}
        />
        <ToggleRow
          label={t("displaySettings.hideOnEscape")}
          checked={settings.hideOnEscape}
          onChange={(hideOnEscape) => void set({ hideOnEscape })}
        />
        <ToggleRow
          label={t("displaySettings.hideOnBlur")}
          checked={settings.hideOnBlur}
          onChange={(hideOnBlur) => void set({ hideOnBlur })}
        />
        <ToggleRow
          label={t("displaySettings.autostart.label")}
          help={t("displaySettings.autostart.help")}
          checked={autostart === true}
          disabled={autostart === null}
          onChange={(enabled) => void changeAutostart(enabled)}
        />
      </div>
    </Dialog>
  );
}

function ToggleRow({
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <section className={styles.toggleRow}>
      <div className={styles.toggleText}>
        <h3 className={styles.label} id={id}>
          {label}
        </h3>
        {help && <p className={styles.help}>{help}</p>}
      </div>
      <Toggle checked={checked} disabled={disabled} aria-labelledby={id} onChange={onChange} />
    </section>
  );
}
