import { EASES } from "../../design/motion/eases";
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
