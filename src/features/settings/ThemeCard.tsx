import { useMemo } from "react";
import type { CSSProperties } from "react";
import { themeVariables } from "../../design/applyTheme";
import type { Theme } from "../../design/theme";
import { t } from "../../i18n";
import { sparks } from "./themeSwap";
import styles from "./ThemeCard.module.css";

/** Size of a theme card (R5-Reglages-Themes.txt §1): 240 × 150. */
const W = 240;
const H = 150;

interface Props {
  theme: Theme;
  active: boolean;
  onChoose: (id: string, card: HTMLElement) => void;
}

/**
 * One theme in Réglages › Thèmes: the home screen in miniature, pure CSS, painted with the theme's
 * own variables set on the card (moon, three cards fanned in its A → B gradient, the bar, the
 * title's rule), its name on a foot shade, a check on the active one. The parts the theme change
 * animates carry `data-swap` (useThemeSwap.ts); nothing is ever laid over the card.
 */
export function ThemeCard({ theme, active, onChoose }: Props) {
  const style = useMemo(() => themeVariables(theme) as CSSProperties, [theme]);
  const dots = useMemo(() => sparks(W, H), []);
  return (
    <button
      type="button"
      className={styles.card}
      style={style}
      aria-pressed={active}
      aria-label={t("settings.themes.apply", { name: theme.name })}
      title={theme.description}
      data-active={active ? "" : undefined}
      onClick={(e) => onChoose(theme.id, e.currentTarget)}
    >
      <span className={styles.face} data-swap="face" aria-hidden="true">
        <span className={styles.halo} />
        <span className={styles.bar} />
        <span className={styles.moon}>
          <span className={styles.moonGlow} data-swap="moon" />
        </span>
        <span className={styles.titleLine} />
        <span className={styles.rule} />
        <span className={styles.fan}>
          <span className={styles.mini} data-i="0" />
          <span className={styles.mini} data-i="2" />
          <span className={styles.mini} data-i="1" />
        </span>
        <span className={styles.sheen} data-swap="sheen" />
        <span className={styles.foot} />
        <span className={styles.name}>{theme.name}</span>
      </span>
      <svg className={styles.frame} data-swap="frame" aria-hidden="true">
        <rect x="1.2" y="1.2" rx="25" pathLength={1} />
      </svg>
      <span className={styles.sparks} data-swap="sparks" aria-hidden="true">
        {dots.map((d, i) => (
          <span
            key={i}
            style={{ left: d.x, top: d.y }}
            data-dx={d.dx.toFixed(1)}
            data-dy={d.dy.toFixed(1)}
            data-delay={d.delay}
          />
        ))}
      </span>
      {active && (
        <span className={styles.check} data-swap="check" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="M3.5 8.4 6.6 11.4 12.6 4.8" />
          </svg>
        </span>
      )}
    </button>
  );
}
