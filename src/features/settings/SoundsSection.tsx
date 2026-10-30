import { useId } from "react";
import { t } from "../../i18n";
import type { SoundPack } from "../../ipc/bindings";
import { previewSound } from "../../sound";
import { hubStore, useHub } from "../../store";
import { ChoiceRow, ToggleRow } from "./SettingRow";
import { VolumeWave } from "./VolumeWave";
import styles from "./Settings.module.css";

const PACKS: readonly SoundPack[] = ["premium", "retro", "chiptune"];

/**
 * Réglages › Sons (step 17b): on / off, the style (Premium · Rétro · 8-bit), the volume as the
 * style's wave, and the three families. Every change is heard at once.
 */
export function SoundsSection() {
  const settings = useHub((s) => s.settings);
  const volumeId = useId();
  if (!settings) return null;
  const set = hubStore.getState().setSettings;
  const pack = settings.soundPack;
  const volume = settings.soundVolume ?? 0.4;
  const off = !settings.soundsOn;

  return (
    <div className={styles.rows} data-cascade="">
      <ToggleRow
        label={t("settings.sounds.on.label")}
        help={t("settings.sounds.on.help")}
        checked={settings.soundsOn}
        onChange={(soundsOn) => {
          void set({ soundsOn });
          if (soundsOn) previewSound("confirm", pack, volume);
        }}
      />
      <ChoiceRow<SoundPack>
        label={t("settings.sounds.pack.label")}
        help={t("settings.sounds.pack.help")}
        value={pack}
        onChange={(soundPack) => {
          void set({ soundPack });
          previewSound("success", soundPack, volume);
        }}
        options={PACKS.map((v) => ({ value: v, label: t(`settings.sounds.pack.${v}`) }))}
      />
      <section className={styles.row} data-row="">
        <h3 className={styles.label} id={volumeId}>
          {t("settings.sounds.volume.label")}
        </h3>
        <VolumeWave
          value={volume}
          pack={pack}
          disabled={off}
          labelledBy={volumeId}
          onCommit={(soundVolume) => {
            void set({ soundVolume });
            previewSound("success", pack, soundVolume);
          }}
        />
        <p className={styles.help}>{t("settings.sounds.volume.help")}</p>
      </section>
      <h3 className={styles.label}>{t("settings.sounds.families.label")}</h3>
      <ToggleRow
        label={t("settings.sounds.families.interface")}
        checked={settings.soundInterface}
        disabled={off}
        onChange={(soundInterface) => {
          void set({ soundInterface });
          if (soundInterface) previewSound("click", pack, volume);
        }}
      />
      <ToggleRow
        label={t("settings.sounds.families.transitions")}
        checked={settings.soundTransitions}
        disabled={off}
        onChange={(soundTransitions) => {
          void set({ soundTransitions });
          if (soundTransitions) previewSound("tab", pack, volume);
        }}
      />
      <ToggleRow
        label={t("settings.sounds.families.launch")}
        checked={settings.soundLaunch}
        disabled={off}
        onChange={(soundLaunch) => {
          void set({ soundLaunch });
          if (soundLaunch) previewSound("launch", pack, volume);
        }}
      />
    </div>
  );
}
