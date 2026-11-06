import { useAutoQuality } from "../../design/autoQualityStore";
import { t, type MessageKey } from "../../i18n";
import styles from "./Settings.module.css";

const NOW: Record<string, MessageKey> = {
  high: "settings.visual.quality.nowHigh",
  hover: "settings.visual.quality.nowHover",
  float: "settings.visual.quality.nowFloat",
  balanced: "settings.visual.quality.nowBalanced",
  eco: "settings.visual.quality.nowEco",
};

/** Under « Qualité » set to Auto (step 24): where it stands right now, and why. */
export function AutoQualityNow() {
  const rung = useAutoQuality((s) => s.rung);
  const reason = useAutoQuality((s) => s.reason);
  const frozen = useAutoQuality((s) => s.frozen);
  const why = [
    reason === "slow" && t("settings.visual.quality.whySlow"),
    reason === "battery" && t("settings.visual.quality.whyBattery"),
    frozen && t("settings.visual.quality.frozen"),
  ].filter(Boolean);
  const level = t(NOW[rung] ?? "settings.visual.quality.nowHigh");
  return (
    <p className={styles.help} role="status">
      {t("settings.visual.quality.now", { level })}
      {why.length > 0 && ` (${why.join(", ")})`}
    </p>
  );
}
