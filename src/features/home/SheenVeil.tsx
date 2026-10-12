import { useEffect, useRef } from "react";
import { useWindowVisible } from "../../app/windowVisible";
import { EASES } from "../../design/motion/eases";
import { GLIDE_SHARE, STILL_AT, sheenCycle } from "../../fx/gpu/sheen";
import { useReducedMotion } from "../../fx/useReducedMotion";
import styles from "./SheenVeil.module.css";

/** Travel of the full-width layer carrying the band (in its centre): from before the card to past it. */
const FROM = -115;
const TO = 115;
const at = (u: number) => `translateX(${FROM + (TO - FROM) * u}%)`;

/** Class of the band, for the veil played once at the hover of a carousel card (round 4a). */
export const sheenBandClass = styles.sheenVeil!;

/** One glide of the band across the card (a one-shot Web Animation, transform only). */
export function sheenGlide(band: HTMLElement, duration: number): Animation {
  band.style.transform = at(0);
  return band.animate([{ transform: at(0) }, { transform: at(1) }], {
    duration,
    easing: EASES.glisse!,
  });
}

/**
 * CSS glossy veil of the selected card (art direction `cardSheen`, round 2b), for when the engine
 * cannot draw it: above a DOM poster, or without the engine (CSS fallback). Same timing as the
 * engine's (src/fx/gpu/sheen.ts). Like Shine.tsx, never an `infinite` CSS animation (it would keep
 * the page producing frames at the screen rate): a one-shot Web Animation per glide and one timer,
 * stopped while the window is hidden.
 * Hidden by CSS where the engine draws the veil itself (SheenVeil.module.css).
 */
export function SheenVeil({ duration }: { duration: number }) {
  const band = useRef<HTMLSpanElement>(null);
  const shown = useWindowVisible();
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = band.current;
    if (!el) return;
    if (reduced) {
      el.style.transform = at(STILL_AT);
      el.dataset.still = "";
      return () => void delete el.dataset.still;
    }
    // Hidden window: no timer (the next glide comes a moment after it is shown again).
    if (!shown) return;
    el.style.transform = at(0);
    let timer = 0;
    const play = () => {
      sheenGlide(el, duration);
      timer = window.setTimeout(play, sheenCycle(duration));
    };
    // First glide a moment after the card became selected (as the engine's: rest share first).
    timer = window.setTimeout(play, duration * (1 / GLIDE_SHARE - 1) * 0.5);
    return () => {
      window.clearTimeout(timer);
      for (const animation of el.getAnimations()) animation.cancel();
      delete el.dataset.still;
    };
  }, [duration, shown, reduced]);

  return (
    <span className={styles.sheenClip} aria-hidden="true">
      <span ref={band} className={styles.sheenVeil} />
    </span>
  );
}
