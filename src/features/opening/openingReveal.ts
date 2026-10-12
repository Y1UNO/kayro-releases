import { lerp } from "../../design/motion/curve";
import { OPENING_C } from "../../design/motion/tokens";
import { ringOutAt, type OpeningGeometry, type OpeningSettings } from "./openingTimeline";

/**
 * Variant C's pulse in the opaque opening (round 4b, R4b-Ouverture-Transparente.txt; validated):
 * until the ringOut, the page is seen only inside the ring, darkened around by a veil; the
 * ringOut itself (same instant, duration and curve as V1-A) sends a wave from the ring and opens
 * the page in a circle up to the farthest corner. No other pulse, nothing else moves.
 * Pure: runOpening.ts writes it.
 */
export interface RevealFrame {
  /** Opacity of the veil around the open circle (0 once the page is whole). */
  veil: number;
  /** The open circle (CSS px), centred on the ring. */
  x: number;
  y: number;
  r: number;
  /** Opacity of the wave riding the circle's edge (0 in Eco). */
  wave: number;
}

export function revealAt(
  time: number,
  s: OpeningSettings,
  g: OpeningGeometry,
  view: { w: number; h: number },
  eco: boolean,
): RevealFrame | null {
  if (s.pulse !== "c") return null;
  const out = ringOutAt(time, s);
  const x = g.logo.x + g.slide;
  const y = g.logo.y;
  const cover = Math.max(
    Math.hypot(x, y),
    Math.hypot(view.w - x, y),
    Math.hypot(x, view.h - y),
    Math.hypot(view.w - x, view.h - y),
  );
  const whole = out >= 1;
  const full = OPENING_C.waveFull;
  const wave = eco || out <= 0 || whole ? 0 : out < full ? 1 : (1 - out) / (1 - full);
  return {
    veil: whole ? 0 : s.veil,
    x,
    y,
    r: lerp(s.ringRadius + OPENING_C.ringMargin, cover, out),
    wave: s.wave * wave,
  };
}
