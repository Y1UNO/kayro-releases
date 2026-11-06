import { t } from "../../i18n";
import type { IslandPassage } from "../../ipc/bindings";
import { hubStore, useHub } from "../../store";
import { IslandTuckRows } from "./IslandTuckRows";
import { ChoiceRow, ToggleRow } from "./SettingRow";
import styles from "./Settings.module.css";

const PASSAGES: readonly IslandPassage[] = ["force", "glitch"];

/**
 * Réglages › Île dynamique (2026-11-02): everything about Kysland in one place — always on
 * screen, « Cacher l'île » and its delays, the passage from one screen to another (Forcer ·
 * Capri). Its start-up choice stays in Démarrage (said here).
 */
export function IslandSection() {
  const settings = useHub((s) => s.settings);
  if (!settings) return null;
  const set = hubStore.getState().setSettings;

  return (
    <div className={styles.rows} data-cascade="">
      <p className={styles.help}>{t("settings.island.intro")}</p>
      <ToggleRow
        label={t("settings.island.always.label")}
        help={t("settings.island.always.help")}
        checked={settings.islandAlways}
        onChange={(islandAlways) => void set({ islandAlways })}
      />
      <IslandTuckRows />
      <ChoiceRow<IslandPassage>
        label={t("settings.island.passage.label")}
        help={t("settings.island.passage.help")}
        value={settings.islandPassage}
        onChange={(islandPassage) => void set({ islandPassage })}
        options={PASSAGES.map((v) => ({ value: v, label: t(`settings.island.passage.${v}`) }))}
      />
      <p className={styles.help}>{t("settings.island.startup")}</p>
    </div>
  );
}
