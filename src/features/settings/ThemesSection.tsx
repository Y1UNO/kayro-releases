import { useTheme } from "../../design";
import { PICKER_THEMES } from "../../design/themes";
import { ThemeCard } from "./ThemeCard";
import { useThemeSwap } from "./useThemeSwap";
import styles from "./Settings.module.css";

/**
 * Réglages › Thèmes (R5-Reglages-Themes.txt §1): the six logo themes as cards (3 columns of
 * 240 × 150, 18 px apart). A click applies the theme with its wave; no « Appliquer » button.
 */
export function ThemesSection() {
  const { theme } = useTheme();
  const choose = useThemeSwap();
  return (
    <div className={styles.themes} data-cascade="">
      {PICKER_THEMES.map((th) => (
        <ThemeCard key={th.id} theme={th} active={th.id === theme.id} onChoose={choose} />
      ))}
    </div>
  );
}
