import { useId } from "react";
import { t } from "../../i18n";
import { hubStore, useHub } from "../../store";
import { NotchSlider } from "./NotchSlider";
import { ToggleRow } from "./SettingRow";
import styles from "./Settings.module.css";

const seconds = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** « 1,5 s », « Aussitôt » for none. */
function delay(value: number): string {
  if (value <= 0) return t("settings.island.tuck.now");
  return t("settings.island.tuck.seconds", { value: seconds.format(value) });
}

/**
 * Réglages › Île dynamique, under « Toujours à l'écran »: « Cacher l'île » (2026-11-02) and
 * its two delays, in notches: before it goes into the top edge, and how long the cursor stays
 * on the top before it comes out.
 */
export function IslandTuckRows() {
  const settings = useHub((s) => s.settings);
  const afterId = useId();
  const peekId = useId();
  if (!settings) return null;
  const set = hubStore.getState().setSettings;
  const off = !settings.islandAlways || !settings.islandTuck;

  return (
    <>
      <ToggleRow
        label={t("settings.island.tuck.label")}
        help={t("settings.island.tuck.help")}
        checked={settings.islandTuck}
        disabled={!settings.islandAlways}
        onChange={(islandTuck) => void set({ islandTuck })}
      />
      <section className={styles.row} data-row="">
        <h3 className={styles.label} id={afterId}>
          {t("settings.island.tuck.after")}
        </h3>
        <NotchSlider
          value={settings.islandTuckDelay ?? 1.5}
          min={0}
          max={3}
          step={0.25}
          disabled={off}
          labelledBy={afterId}
          format={delay}
          onCommit={(islandTuckDelay) => void set({ islandTuckDelay })}
        />
        <p className={styles.help}>{t("settings.island.tuck.afterHelp")}</p>
      </section>
      <section className={styles.row} data-row="">
        <h3 className={styles.label} id={peekId}>
          {t("settings.island.tuck.peek")}
        </h3>
        <NotchSlider
          value={settings.islandPeekDelay ?? 0.1}
          min={0}
          max={1}
          step={0.1}
          disabled={off}
          labelledBy={peekId}
          format={delay}
          onCommit={(islandPeekDelay) => void set({ islandPeekDelay })}
        />
        <p className={styles.help}>{t("settings.island.tuck.peekHelp")}</p>
      </section>
    </>
  );
}
