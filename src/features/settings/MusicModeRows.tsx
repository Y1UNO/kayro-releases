import { useId, useState } from "react";
import { ChevronDownIcon } from "../../design/icons";
import { t } from "../../i18n";
import type { MusicColors, MusicQuality, SettingsPatch } from "../../ipc/bindings";
import { hubStore, useHub } from "../../store";
import { NotchSlider } from "./NotchSlider";
import { ChoiceRow, ToggleRow } from "./SettingRow";
import styles from "./Settings.module.css";

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const times = (v: number) => t("settings.visual.music.times", { value: number.format(v) });
const percent = (v: number) => t("settings.visual.music.percent", { value: Math.round(v * 100) });
const ms = (v: number) => t("settings.visual.music.delay.ms", { value: Math.round(v) });

/** A labelled slider row. */
function SliderRow(p: {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onCommit: (v: number) => void;
}) {
  const id = useId();
  return (
    <section className={styles.row} data-row="">
      <h3 className={styles.label} id={id}>
        {p.label}
      </h3>
      <NotchSlider
        value={p.value}
        min={p.min}
        max={p.max}
        step={p.step}
        labelledBy={id}
        format={p.format}
        onCommit={p.onCommit}
      />
      {p.help && <p className={styles.help}>{p.help}</p>}
    </section>
  );
}

const SENSES = ["Kick", "Snare", "Hat", "Crash"] as const;

/**
 * Réglages › Visuel › Mode musique (2026-11-03, SPEC §6): the bass's and the crash's
 * intensities, the trails and the gloss in sight; in « Avancé », the detection's sensitivity per
 * instrument, the sound/image delay, the quality, the test track and the colours.
 */
export function MusicModeRows() {
  const settings = useHub((s) => s.settings);
  const [open, setOpen] = useState(false);
  const regionId = useId();
  if (!settings) return null;
  const set = (patch: SettingsPatch) => void hubStore.getState().setSettings(patch);

  return (
    <>
      <section className={styles.row} data-row="">
        <h3 className={styles.label}>{t("settings.visual.music.title")}</h3>
        <p className={styles.help}>{t("settings.visual.music.intro")}</p>
      </section>
      <SliderRow
        label={t("settings.visual.music.bass.label")}
        help={t("settings.visual.music.bass.help")}
        value={settings.musicBass ?? 1}
        min={0}
        max={2}
        step={0.25}
        format={times}
        onCommit={(musicBass) => set({ musicBass })}
      />
      <SliderRow
        label={t("settings.visual.music.crash.label")}
        help={t("settings.visual.music.crash.help")}
        value={settings.musicCrash ?? 1}
        min={0}
        max={2}
        step={0.25}
        format={times}
        onCommit={(musicCrash) => set({ musicCrash })}
      />
      <SliderRow
        label={t("settings.visual.music.trails.label")}
        help={t("settings.visual.music.trails.help")}
        value={settings.musicTrails ?? 0.6}
        min={0}
        max={1}
        step={0.1}
        format={percent}
        onCommit={(musicTrails) => set({ musicTrails })}
      />
      <SliderRow
        label={t("settings.visual.music.gloss.label")}
        help={t("settings.visual.music.gloss.help")}
        value={settings.musicGloss ?? 0}
        min={0}
        max={1}
        step={0.1}
        format={percent}
        onCommit={(musicGloss) => set({ musicGloss })}
      />
      <section className={styles.row} data-row="">
        <button
          type="button"
          className={styles.link}
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen(!open)}
        >
          {t("settings.visual.music.advanced")}{" "}
          <ChevronDownIcon
            aria-hidden="true"
            style={{ transform: open ? "rotate(180deg)" : undefined, verticalAlign: "middle" }}
          />
        </button>
      </section>
      {open && (
        <div id={regionId}>
          {SENSES.map((k) => (
            <SliderRow
              key={k}
              label={`${t("settings.visual.music.sense.label")} · ${t(`settings.visual.music.sense.${k.toLowerCase() as "kick"}`)}`}
              help={k === "Kick" ? t("settings.visual.music.sense.help") : undefined}
              value={settings[`musicSense${k}`] ?? 1}
              min={0.5}
              max={2}
              step={0.25}
              format={times}
              onCommit={(v) => set({ [`musicSense${k}`]: v })}
            />
          ))}
          <SliderRow
            label={t("settings.visual.music.delay.label")}
            help={t("settings.visual.music.delay.help")}
            value={settings.musicDelayMs ?? 0}
            min={0}
            max={250}
            step={25}
            format={ms}
            onCommit={(musicDelayMs) => set({ musicDelayMs })}
          />
          <ChoiceRow<MusicQuality>
            label={t("settings.visual.music.quality.label")}
            help={t("settings.visual.music.quality.help")}
            value={settings.musicQuality}
            onChange={(musicQuality) => set({ musicQuality })}
            options={(["auto", "low", "medium", "high"] as const).map((q) => ({
              value: q,
              label: t(`settings.visual.music.quality.${q}`),
            }))}
          />
          <ChoiceRow<MusicColors>
            label={t("settings.visual.music.colors.label")}
            help={t("settings.visual.music.colors.help")}
            value={settings.musicColors}
            onChange={(musicColors) => set({ musicColors })}
            options={(["cover", "theme"] as const).map((c) => ({
              value: c,
              label: t(`settings.visual.music.colors.${c}`),
            }))}
          />
          <ToggleRow
            label={t("settings.visual.music.demo.label")}
            help={t("settings.visual.music.demo.help")}
            checked={settings.musicDemo}
            onChange={(musicDemo) => set({ musicDemo })}
          />
        </div>
      )}
    </>
  );
}
