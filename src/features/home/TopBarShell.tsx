import type { ReactNode } from "react";
import { APP_NAME } from "../../app/appName";
import { Logo } from "../../brand";
import { ChevronLeftIcon, Surface } from "../../design";
import styles from "./TopBar.module.css";

interface Props {
  /** After the brand: « Toutes les catégories », « ‹ Accueil », « ‹ Scènes »… */
  left?: ReactNode;
  /** The middle: the search field. */
  center?: ReactNode;
  /** The tools / actions at the right end. */
  right?: ReactNode;
}

/**
 * The one top bar of Kayro (round 5, proposal 4): the same glass, height, brand and margins on
 * the home screen, the scenes and the editor; only its three zones change.
 */
export function TopBarShell({ left, center, right }: Props) {
  return (
    <Surface
      as="header"
      glassKind="bar"
      radius="var(--da-bar-radius, var(--radius-pill))"
      className={styles.bar}
    >
      <div className={styles.left}>
        <div className={styles.brand}>
          <Logo size={30} className={styles.logo} />
          <span>{APP_NAME}</span>
        </div>
        {left}
      </div>
      {center}
      <div className={styles.tools}>{right}</div>
    </Surface>
  );
}

/** The bar's « back » pill (« Toutes les catégories » look): « ‹ Accueil », « ‹ Scènes ». */
export function BarBack({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.back} onClick={onClick}>
      <ChevronLeftIcon size={14} />
      {label}
    </button>
  );
}
