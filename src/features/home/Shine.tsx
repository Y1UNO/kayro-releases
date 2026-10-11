import { useEffect, useRef } from "react";
import styles from "./Shine.module.css";

/** One sweep every 6 s (mock-up), first one a moment after the card became active. */
const PERIOD_MS = 6000;
const FIRST_DELAY_MS = 2500;
/** Mock-up: 2.7 s. Shorter here: see below. */
const SWEEP_MS = 1400;

const REST = "translateX(0) skewX(-14deg)";
const END = "translateX(500%) skewX(-14deg)";

/**
 * The light band that crosses the active card.
 *
 * Not a CSS `infinite` animation: an animation that never ends keeps the browser producing a
 * frame on every screen refresh even while the band is off the card (measured: 17 % of a core at
 * idle on a 279 Hz screen, against 1 % without it). Here the animation only exists while the band
 * moves (a one-shot Web Animation), and a single timer starts the next one. Transform only.
 */
export function Shine() {
  const band = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = band.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const play = () => {
      el.animate([{ transform: REST }, { transform: END }], {
        duration: SWEEP_MS,
        easing: "ease-in-out",
      });
      timer = window.setTimeout(play, PERIOD_MS);
    };
    timer = window.setTimeout(play, FIRST_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      for (const animation of el.getAnimations()) animation.cancel();
    };
  }, []);

  return (
    <span className={styles.shineClip} aria-hidden="true">
      <span ref={band} className={styles.shine} />
    </span>
  );
}
