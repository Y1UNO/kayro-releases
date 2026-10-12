import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { Logo } from "../../brand";
import { daStore } from "../../design/da";
import { t } from "../../i18n";
import { openingSettings } from "./openingTimeline";
import { LETTERS, runOpening } from "./runOpening";
import styles from "./Opening.module.css";

interface Props {
  /** The screen under the opening: hidden, then faded in by the hand-off. */
  under: RefObject<HTMLElement | null>;
  onDone: () => void;
  /** Dev: shows this moment (ms) and stays there. */
  seek?: number | null;
}

/**
 * Opening V1-A (art direction round 3), once per start of the program: the background fades in,
 * the ring hatches and the halo opens (drawn by the glass engine through a cue; plain CSS shapes
 * when the engine is off), the logo forms, slides left, and the letters of the name come out from
 * behind it. A click, Escape, Enter or Space skips it (Tab passes); reduced motion shows the
 * finished picture at once.
 * Only transform and opacity move: blur is a cross-fade with a still blurred copy (none in Eco).
 * Round 4b (`pulse` "c", default): variant C's pulse, the page seen only in the ring until the
 * ringOut opens it in a circle with a wave (openingReveal.ts).
 * The sequence itself: runOpening.ts (pure timing: openingTimeline.ts).
 */
export function Opening({ under, onDone, seek = null }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  const pulseC = openingSettings(daStore.getState().values.opening).pulse === "c";
  useEffect(() => {
    done.current = onDone;
  });

  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    return runOpening(host, under.current, seek, () => done.current());
  }, [under, seek]);

  return (
    <div ref={root} className={styles.root} role="presentation">
      <span className={styles.hint} role="status">
        {t("opening.skip")}
      </span>
      <div data-part="bg" className={styles.bg} aria-hidden="true">
        <div data-part="bg-light" className={styles.bgLight} />
      </div>
      <div className={styles.centre} aria-hidden="true">
        <div data-part="halo" className={styles.halo} />
        <div data-part="ring" className={styles.ring} />
      </div>
      {pulseC && (
        <>
          <div data-part="veil" className={styles.veil} aria-hidden="true" />
          <div data-part="wave" className={styles.wave} aria-hidden="true" />
        </>
      )}
      <div className={styles.row} aria-hidden="true">
        <div className={styles.logoBox}>
          <div data-part="logo-blur" className={`${styles.logo} ${styles.soft}`}>
            <Logo size={151} />
          </div>
          <div data-part="logo" className={styles.logo}>
            <Logo size={151} />
            <div className={styles.sheenClip}>
              <div data-part="sheen" className={styles.sheen} />
            </div>
          </div>
        </div>
        <div className={styles.word}>
          <div className={styles.letters}>
            {LETTERS.map((c, i) => (
              <span key={i} className={styles.slot}>
                <span data-part="letter-blur" className={styles.blurred}>
                  {c}
                </span>
                <span data-part="letter" className={styles.letter}>
                  {c}
                </span>
              </span>
            ))}
          </div>
          <div data-part="line" className={styles.line} />
          <div data-part="sub" className={styles.sub}>
            {t("opening.subtitle")}
          </div>
        </div>
      </div>
    </div>
  );
}
