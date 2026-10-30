import { finaleAt, TIMING } from "./cinema/scene";
import { SEAL } from "./seal";

/**
 * The launch sequence at one moment (pure, seal.ts for the values). `landedAt`: when the game's
 * window came up (ms from the start), `skipAt`: when the user asked to skip; null = not yet.
 */
export interface SealFrame {
  /** The scene over the hub (0 = only the card, 1 = full night). */
  cover: number;
  smoke: number;
  swirl: number;
  /** Light of the flames (ground pool, the card). */
  fire: number;
  card: { z: number; lift: number; yaw: number; bob: number; light: number; burn: number };
  ground: { draw: number; runes: number };
  seal: {
    alpha: number;
    draw: number;
    runes: number;
    star: number;
    spin: number;
    yaw: number;
    size: number;
  };
  /** Growth of each flame (0–~1.1, overshoot), and the finale's surge on top. */
  flames: number[];
  surge: number;
  pillar: number;
  flash: number;
  black: number;
  caption: number;
  /** When the finale starts (ms from the start). */
  finaleAt: number;
  done: boolean;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const out3 = (x: number) => 1 - (1 - x) ** 3;
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
/** Overshoot then settle (a flame catching). */
export const back = (x: number) => (x <= 0 ? 0 : 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2);

/** When the finale starts: after the minimum, once the game is up (or skipped), at the latest at the ceiling. */
export function finaleStart(landedAt: number | null, skipAt: number | null): number {
  return finaleAt(landedAt, skipAt, SEAL.finale.ms);
}

export function sealFrame(t: number, landedAt: number | null, skipAt: number | null): SealFrame {
  const s = t / 1000;
  const F = SEAL.finale;
  const at = finaleStart(landedAt, skipAt);
  const f = t - at;
  const fin = (r: readonly number[]) => span(f, r[0]!, r[1]!);
  const surge = smooth(fin(F.surge));
  const collapse = inOut(fin(F.collapse));
  const { count, from, stagger, growMs } = SEAL.flames;
  // A skip before the flames caught: they all catch at once in the surge.
  const flames = Array.from({ length: count }, (_, k) => {
    const own = back(span(t, from + k * stagger, from + k * stagger + growMs));
    return Math.max(own, back(span(f, 0, 380)));
  });
  const fire = flames.reduce((a, b) => a + Math.min(1, b), 0) / count;
  const hold = clamp01((t - TIMING.minHold) / 4000);
  const move = inOut(span(t, SEAL.card.moveFrom, SEAL.card.moveTo));
  const G = SEAL.ground;
  const S = SEAL.seal;
  return {
    cover: out3(span(t, 0, SEAL.inMs)),
    smoke: smooth(span(t, 300, 1800)),
    swirl: 0.35 + 0.15 * hold + 1.6 * surge,
    fire: fire * (1 + 0.6 * surge),
    card: {
      z: SEAL.card.back * move,
      lift: SEAL.card.lift * move - 30 * surge,
      yaw: SEAL.card.yaw * move + 2.5 * Math.sin(s * 0.9) * move,
      bob: SEAL.card.bob * Math.sin(s * 1.7) * move,
      light: fire * (0.85 + 0.15 * Math.sin(s * 9.1) * Math.sin(s * 5.3)),
      burn: smooth(fin(F.burn)),
    },
    ground: { draw: out3(span(t, G.from, G.to)), runes: span(t, G.runesFrom, G.runesTo) },
    seal: {
      alpha: smooth(span(t, S.showFrom, S.showTo)) * (1 - collapse),
      draw: out3(span(t, S.from, S.to)),
      runes: span(t, S.runesFrom, S.runesTo),
      star: smooth(span(t, SEAL.star.from, SEAL.star.to)),
      spin: 0.15 * s + 4 * collapse * collapse,
      yaw: 0.18 * Math.sin(s * 0.6),
      size: 1 - 0.85 * collapse,
    },
    flames,
    surge,
    pillar: smooth(fin(F.pillar)),
    flash: smooth(fin(F.flash)),
    black: smooth(fin(F.black)),
    caption: smooth(span(t, SEAL.caption.from, SEAL.caption.to)) * (1 - smooth(fin([0, 400]))),
    finaleAt: at,
    done: f >= F.ms,
  };
}
