import type { CSSProperties, ReactNode } from "react";
import type { CategoryId } from "../categories";
import styles from "./CategoryEmblem.module.css";

/** Index of a part in its cascade (delay = --i × the stagger of CategoryEmblem.module.css). */
const at = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * Steps 16–17: the own design of each category card, an original fine-line emblem (64 × 64 view
 * box, stroked in the text colour) whose parts move once when the card is hovered or focused:
 * games, embers rising off a pad; stream, waves leaving a mast; creativity, the pen dips and a
 * spark turns; software, two windows part; others, a constellation twinkles. `mark`: the faint
 * large copy behind the face, which never moves. Decorative: hidden from assistive tech.
 */
export function CategoryEmblem({ id, mark = false }: { id: CategoryId; mark?: boolean }) {
  return (
    <svg
      className={mark ? styles.mark : styles.emblem}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-emblem={id}
    >
      {SHAPES[id]}
    </svg>
  );
}

const SHAPES: Record<CategoryId, ReactNode> = {
  jeux: (
    <>
      <path d="M19 26h26c5.6 0 8.8 3.6 10.2 9l2.3 9.4c.9 4-1.3 6.8-4.5 6.8-2.3 0-3.7-1.3-5-3.6L45.5 44h-27L16 47.6c-1.3 2.3-2.7 3.6-5 3.6-3.2 0-5.4-2.8-4.5-6.8L8.8 35c1.4-5.4 4.6-9 10.2-9z" />
      <path d="M20.5 32.5v7 M17 36h7" />
      <circle cx="43" cy="34" r="1.6" className={styles.dot} />
      <circle cx="47.5" cy="38.5" r="1.6" className={styles.dot} />
      <circle cx="26" cy="18" r="1.3" className={`${styles.dot} ${styles.ember}`} style={at(0)} />
      <circle cx="32" cy="13" r="1.6" className={`${styles.dot} ${styles.ember}`} style={at(1)} />
      <circle cx="38" cy="18.5" r="1.1" className={`${styles.dot} ${styles.ember}`} style={at(2)} />
    </>
  ),
  stream: (
    <>
      <circle cx="32" cy="29" r="3" className={styles.dot} />
      <path d="M32 33v18 M25 53h14 M27.5 51l4.5-18 4.5 18" />
      <path
        className={styles.wave}
        style={at(0)}
        d="M39.5 22a10.5 10.5 0 0 1 0 14 M24.5 22a10.5 10.5 0 0 0 0 14"
      />
      <path
        className={styles.wave}
        style={at(1)}
        d="M45 16.5a18 18 0 0 1 0 25 M19 16.5a18 18 0 0 0 0 25"
      />
    </>
  ),
  creativite: (
    <>
      <g className={styles.pen}>
        <path d="M43 11l10 10-21.5 21.5-12.5 2.5 2.5-12.5z" />
        <path d="M38.5 15.5l10 10 M22.5 42l-2.5-2.5" />
      </g>
      <path d="M9 54c7-5 12.5 1.5 19.5-2.5S40 45 47 48.5" />
      <path
        className={styles.spark}
        d="M52 40l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z"
      />
    </>
  ),
  logiciels: (
    <>
      <g className={styles.back}>
        <path d="M20 38h-4a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v6" />
        <path d="M12 20h32" />
      </g>
      <g className={styles.front}>
        <rect x="20" y="24" width="32" height="24" rx="4" />
        <path d="M20 30h32 M25.5 36h14 M25.5 41h8.5" />
        <circle cx="24" cy="27" r=".9" className={styles.dot} />
      </g>
    </>
  ),
  autres: (
    <>
      <path className={styles.faint} d="M13 41L25 22l13 8 12-16 M38 30l10 17" />
      <circle cx="13" cy="41" r="2" className={`${styles.dot} ${styles.star}`} style={at(0)} />
      <circle cx="25" cy="22" r="2.4" className={`${styles.dot} ${styles.star}`} style={at(1)} />
      <circle cx="38" cy="30" r="2" className={`${styles.dot} ${styles.star}`} style={at(2)} />
      <circle cx="50" cy="14" r="2.6" className={`${styles.dot} ${styles.star}`} style={at(3)} />
      <circle cx="48" cy="47" r="1.8" className={`${styles.dot} ${styles.star}`} style={at(4)} />
    </>
  ),
};
