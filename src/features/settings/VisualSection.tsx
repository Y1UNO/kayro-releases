import { useEffect, useRef, useState } from "react";
import { Button, SegmentedControl } from "../../design";
import { t } from "../../i18n";
import type {
  ColorMode,
  DisplayMode,
  MonitorInfo,
  Quality,
  SettingsPatch,
} from "../../ipc/bindings";
import { desktopIpc } from "../../ipc/commands";
import { hubStore, useHub } from "../../store";
import type { MotionStyle } from "../../design/motion/tokens5";
import { AdvancedSection } from "./AdvancedSection";
import { MusicModeRows } from "./MusicModeRows";
import { ChoiceRow, ToggleRow } from "./SettingRow";
import {
  ATMOSPHERE,
  atmosphereLevel,
  isVisualDefault,
  QUALITY_CHOICES,
  VISUAL_DEFAULTS,
  visualSnapshot,
  type AtmosphereLevel,
} from "./settingsModel";
import styles from "./Settings.module.css";

/** « Écran 2 · 2560×1440 » from Windows' `\\.\DISPLAY2`. */
function screenLabel(m: MonitorInfo, index: number): string {
  const n = /DISPLAY(\d+)/i.exec(m.name)?.[1] ?? String(index + 1);
  return t("settings.visual.screen.item", { name: `${n}`, width: m.width, height: m.height });
}

/**
 * Réglages › Visuel (round 5): the most useful choices on top, « Personnalisation avancée »
 * folded below, and « Revenir aux réglages par défaut » (undoable while the dialog is open).
 */
export function VisualSection() {
  const settings = useHub((s) => s.settings);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  // What the reset replaced, while the dialog is open (« Annuler »).
  const [undo, setUndo] = useState<SettingsPatch | null>(null);
  const below = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void desktopIpc.monitors().then((r) => live && r.ok && setMonitors(r.value));
    return () => {
      live = false;
    };
  }, []);

  // A Visuel choice left the defaults after the reset: « Annuler » would undo it too (review A9).
  // Derived state, dropped during render (the reset itself is applied at once: optimistic store).
  if (undo && settings && !isVisualDefault(settings)) setUndo(null);

  if (!settings) return null;
  const set = (patch: SettingsPatch) => void hubStore.getState().setSettings(patch);

  async function chooseScreen(name: string) {
    await desktopIpc.chooseMonitor(name);
    const r = await desktopIpc.monitors();
    if (r.ok) setMonitors(r.value);
  }

  function reset() {
    if (!settings) return;
    setUndo(visualSnapshot(settings));
    set(VISUAL_DEFAULTS);
  }

  const chosen = monitors.find((m) => m.chosen) ?? monitors[0];

  return (
    <div className={styles.rows} data-cascade="">
      <ChoiceRow<Quality>
        label={t("settings.visual.quality.label")}
        help={t("settings.visual.quality.help")}
        value={settings.quality}
        onChange={(quality) => set({ quality })}
        options={QUALITY_CHOICES.map((q) => ({
          value: q,
          label: t(`settings.visual.quality.${q}`),
        }))}
      />
      <ChoiceRow<AtmosphereLevel>
        label={t("settings.visual.atmosphere.label")}
        help={t("settings.visual.atmosphere.help")}
        value={atmosphereLevel(settings.atmosphereIntensity)}
        onChange={(level) => set({ atmosphereIntensity: ATMOSPHERE[level] })}
        options={(["soft", "normal", "strong"] as const).map((l) => ({
          value: l,
          label: t(`settings.visual.atmosphere.${l}`),
        }))}
      />
      <ChoiceRow<ColorMode>
        label={t("settings.visual.gameColors.label")}
        help={t("settings.visual.gameColors.help")}
        value={settings.colorMode}
        onChange={(colorMode) => set({ colorMode })}
        options={(["off", "light"] as const).map((m) => ({
          value: m,
          label: t(`settings.visual.gameColors.${m}`),
        }))}
      />
      <ChoiceRow<MotionStyle>
        label={t("settings.visual.motion.label")}
        help={t("settings.visual.motion.help")}
        value={settings.motionStyle}
        onChange={(motionStyle) => set({ motionStyle })}
        options={(["complete", "lively", "crisp"] as const).map((m) => ({
          value: m,
          label: t(`settings.visual.motion.${m}`),
        }))}
      />
      <ToggleRow
        label={t("settings.visual.followSystem.label")}
        help={t("settings.visual.followSystem.help")}
        checked={settings.followSystemMotion}
        onChange={(followSystemMotion) => set({ followSystemMotion })}
      />
      <ChoiceRow<DisplayMode>
        label={t("settings.visual.launch.label")}
        help={t("settings.visual.launch.help")}
        value={settings.displayMode}
        onChange={(displayMode) => set({ displayMode })}
        options={(["immersive", "window"] as const).map((m) => ({
          value: m,
          label: t(`home.modes.${m}`),
        }))}
      >
        {monitors.length > 1 && chosen && (
          <SegmentedControl<string>
            label={t("settings.visual.screen.label")}
            size="sm"
            value={chosen.name}
            onChange={(name) => void chooseScreen(name)}
            options={monitors.map((m, i) => ({ value: m.name, label: screenLabel(m, i) }))}
          />
        )}
      </ChoiceRow>

      <MusicModeRows />

      <AdvancedSection below={below} />

      <div ref={below} className={styles.resetRow} data-row="">
        <Button
          size="sm"
          disabled={isVisualDefault(settings)}
          onClick={reset}
          className={styles.reset}
        >
          {t("settings.visual.reset.label")}
        </Button>
        {undo && (
          <p className={styles.help} role="status">
            {t("settings.visual.reset.done")}{" "}
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                set(undo);
                setUndo(null);
              }}
            >
              {t("settings.visual.reset.undo")}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
