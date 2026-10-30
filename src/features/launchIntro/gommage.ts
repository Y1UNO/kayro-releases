import { finaleAt, TIMING } from "./cinema/scene";

/**
 * Launch sequence « Gommage » (30/10, Clair Obscur: Expedition 33: a painted Belle Époque world
 * in light and shadow, a Monolith on which a number is painted each year, people erased in swirls
 * of red petals). 3rd version: the first one's chiaroscuro (a golden spotlight on the card in a
 * dark painted canvas, brushstrokes, a far monolith, gilded corners), its strokes given relief
 * and lit by the scene, its light in rays, petals that glow. Original shapes only. Its own
 * palette (it does not take the game's colours). Times in ms (finale: from its start).
 */
export const GOMMAGE = {
  inMs: 700,
  /** The spotlight from above (chiaroscuro). */
  light: [300, 1500],
  /** Five brushstrokes laid one after the other behind the card. */
  strokes: [600, 2600],
  /** The far monolith rises out of the haze; its number is painted. */
  mono: { rise: [1400, 2900], paint: [2500, 3600] },
  /** Gilded corners and frame. */
  filigree: [2600, 3900],
  /** Petals drifting in the wind. */
  petals: [2900, 4300],
  card: { back: 60, yaw: 4, lift: -10, moveFrom: 200, moveTo: 1800 },
  finale: {
    ms: 1400,
    wind: [0, 700],
    erase: [120, 1000],
    flare: [450, 1000],
    flash: [950, 1250],
    black: [1200, 1400],
  },
  /** Petals in the air (Eco: half), and the wind's strength in the finale (× calm). */
  ambient: 150,
  gust: 2.2,
  caption: [3600, 4400],
  /** The number painted on the monolith (the expedition's). */
  number: "33",
  focal: 1.6,
  res: { high: 0.8, eco: 0.5 },
} as const;

/** The scene's own colours (0–1): charcoal, umber, ochre, gold, cream, crimson, brick, blush. */
export const PAINT = {
  charcoal: [0.035, 0.03, 0.028],
  umber: [0.23, 0.16, 0.11],
  ochre: [0.48, 0.33, 0.15],
  gold: [0.86, 0.71, 0.43],
  cream: [0.94, 0.9, 0.81],
  crimson: [0.69, 0.08, 0.17],
  brick: [0.49, 0.17, 0.13],
  blush: [0.95, 0.8, 0.78],
} as const;

export interface GommageFrame {
  cover: number;
  light: number;
  strokes: number;
  mono: { rise: number; paint: number; glow: number };
  filigree: number;
  petals: number;
  /** The wind's own clock (s): runs faster in the finale's gust; `gust`: its extra seconds. */
  windT: number;
  gust: number;
  erase: number;
  flare: number;
  flash: number;
  black: number;
  caption: number;
  card: { z: number; lift: number; bob: number; yaw: number; light: number };
  finaleAt: number;
  done: boolean;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, r: readonly number[]) => clamp01((t - r[0]!) / (r[1]! - r[0]!));
const smooth = (x: number) => x * x * (3 - 2 * x);
const out3 = (x: number) => 1 - (1 - x) ** 3;
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** Extra seconds of wind gained in the gust at `f` ms into the finale (∫ of its smoothstep). */
function gustTime(f: number): number {
  const [a, b] = GOMMAGE.finale.wind;
  if (f <= a) return 0;
  const d = (b - a) / 1000;
  const x = clamp01((f - a) / (b - a));
  return GOMMAGE.gust * (d * (x ** 3 - x ** 4 / 2) + Math.max(0, f - b) / 1000);
}

export function gommageFrame(t: number, landed: number | null, skip: number | null): GommageFrame {
  const G = GOMMAGE;
  const F = G.finale;
  const at = finaleAt(landed, skip, F.ms);
  const f = t - at;
  const s = t / 1000;
  const move = inOut(span(t, [G.card.moveFrom, G.card.moveTo]));
  const flare = smooth(span(f, F.flare));
  const flicker = 0.96 + 0.04 * Math.sin(s * 2.3) * Math.sin(s * 3.7);
  const light = smooth(span(t, G.light)) * flicker + 0.6 * flare;
  const hold = clamp01((t - TIMING.minHold) / 4000);
  return {
    cover: out3(span(t, [0, G.inMs])),
    light,
    strokes: span(t, G.strokes),
    mono: {
      rise: inOut(span(t, G.mono.rise)),
      paint: span(t, G.mono.paint),
      glow: 0.55 + 0.25 * Math.sin(s * 1.4) * span(t, G.mono.paint) + flare,
    },
    filigree: out3(span(t, G.filigree)),
    petals: Math.max(smooth(span(t, G.petals)), smooth(span(f, [0, 300]))),
    windT: s + gustTime(f) + 0.3 * hold,
    gust: gustTime(f),
    erase: span(f, F.erase),
    flare,
    flash: smooth(span(f, F.flash)),
    black: smooth(span(f, F.black)),
    caption: smooth(span(t, G.caption)) * (1 - smooth(span(f, [0, 400]))),
    card: {
      z: G.card.back * move,
      lift: G.card.lift * move,
      bob: 3 * Math.sin(s * 1.3) * move,
      yaw: G.card.yaw * move * Math.sin(s * 0.5 + 0.6),
      light,
    },
    finaleAt: at,
    done: f >= F.ms,
  };
}
