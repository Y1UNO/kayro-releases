/**
 * Step 20 (Kysland): the « Glitch » sounds, made sample by sample (plain notes cannot glitch):
 * crushed tones (few levels, held samples: the sound of a broken digital line), bursts of lo-fi
 * noise, and stutters (one slice repeated, the way a stuck buffer sounds). Each play varies a
 * little. Pure: returns the samples (-1…1), the engine plays them.
 */
import type { IslandSound } from "./islandSounds";

type Rand = () => number;

/** A sweep from `f0` to `f1` Hz, square, crushed to `levels` steps and held `hold` samples. */
export function crushed(
  rate: number,
  dur: number,
  f0: number,
  f1: number,
  levels = 4,
  hold = 6,
): Float32Array<ArrayBuffer> {
  const n = Math.max(1, Math.round(dur * rate));
  const out = new Float32Array(n);
  let phase = 0;
  let held = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 * (f1 / f0) ** (i / n);
    phase += f / rate;
    if (i % hold === 0) {
      const square = phase % 1 < 0.5 ? 1 : -1;
      const saw = (phase % 1) * 2 - 1;
      held = Math.round(((square * 0.7 + saw * 0.3) * levels) / 2) / (levels / 2);
    }
    out[i] = held;
  }
  return out;
}

/** Lo-fi noise: a random value held `hold` samples. */
export function noise(
  rate: number,
  dur: number,
  hold: number,
  rand: Rand,
): Float32Array<ArrayBuffer> {
  const n = Math.max(1, Math.round(dur * rate));
  const out = new Float32Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    if (i % hold === 0) v = rand() * 2 - 1;
    out[i] = v;
  }
  return out;
}

/** The first `slice` seconds of `src`, played `times` times in a row. */
export function stutter(
  src: Float32Array,
  rate: number,
  slice: number,
  times: number,
): Float32Array<ArrayBuffer> {
  const len = Math.min(src.length, Math.max(1, Math.round(slice * rate)));
  const out = new Float32Array(len * times);
  for (let t = 0; t < times; t++) out.set(src.subarray(0, len), t * len);
  return out;
}

/** Joins parts end to end, each at its own level, with a 2 ms fade at every cut (no clicks). */
export function join(
  rate: number,
  parts: readonly [Float32Array, number][],
): Float32Array<ArrayBuffer> {
  const total = parts.reduce((s, [p]) => s + p.length, 0);
  const out = new Float32Array(total);
  const fade = Math.max(1, Math.round(0.002 * rate));
  let at = 0;
  for (const [p, level] of parts) {
    for (let i = 0; i < p.length; i++) {
      const edge = Math.min(1, i / fade, (p.length - 1 - i) / fade);
      out[at + i] = (p[i] ?? 0) * level * Math.max(0, edge);
    }
    at += p.length;
  }
  return out;
}

/** The « Glitch » sound of a moment, at `rate` samples a second. */
export function glitchVoice(
  sound: IslandSound,
  rate: number,
  rand: Rand = Math.random,
): Float32Array<ArrayBuffer> {
  const v = (x: number) => x * (0.9 + rand() * 0.2);
  switch (sound) {
    case "cross": {
      const sweep = crushed(rate, 0.09, v(200), v(1600), 4, 5);
      return join(rate, [
        [noise(rate, 0.025, 8, rand), 0.5],
        [stutter(sweep, rate, 0.018, 4), 0.55],
        [crushed(rate, 0.04, v(380), v(1900), 3, 4), 0.5],
        [noise(rate, 0.012, 3, rand), 0.35],
        [crushed(rate, 0.02, v(2400), v(2400), 2, 3), 0.3],
      ]);
    }
    case "detach": {
      const fall = crushed(rate, 0.05, v(1200), v(120), 4, 6);
      return join(rate, [
        [fall, 0.55],
        [noise(rate, 0.016, 6, rand), 0.45],
        [stutter(fall.subarray(fall.length >> 1), rate, 0.014, 3), 0.4],
      ]);
    }
    case "dock":
      return join(rate, [
        [noise(rate, 0.008, 2, rand), 0.5],
        [crushed(rate, 0.06, v(110), v(70), 3, 10), 0.65],
        [crushed(rate, 0.015, v(1600), v(1600), 2, 3), 0.3],
        [new Float32Array(Math.round(0.02 * rate)), 0],
        [crushed(rate, 0.015, v(1600), v(1600), 2, 3), 0.25],
      ]);
    case "snap":
      return join(rate, [
        [crushed(rate, 0.02, v(2100), v(2100), 2, 3), 0.35],
        [crushed(rate, 0.02, v(1050), v(1050), 2, 4), 0.3],
      ]);
    case "open": {
      const rise = crushed(rate, 0.08, v(220), v(900), 4, 6);
      return join(rate, [
        [stutter(rise, rate, 0.02, 3), 0.45],
        [rise, 0.45],
        [noise(rate, 0.01, 4, rand), 0.3],
      ]);
    }
    case "close": {
      const fall = crushed(rate, 0.08, v(900), v(220), 4, 6);
      return join(rate, [
        [fall, 0.45],
        [stutter(fall.subarray(fall.length >> 1), rate, 0.015, 2), 0.35],
      ]);
    }
  }
}

/** How long the hum lasts before it loops (60 Hz × 1.6 s: whole cycles, a seamless loop). */
export const HUM_SECONDS = 1.6;

/**
 * The hum of an edge glitching under the island (it loops while the island sits across two
 * screens): a low crushed drone, sparse crackles of noise, and now and then a stuttering chirp.
 */
export function glitchHum(rate: number, rand: Rand = Math.random): Float32Array<ArrayBuffer> {
  const n = Math.round(HUM_SECONDS * rate);
  const out = crushed(rate, HUM_SECONDS, 60, 60, 3, 24);
  for (let i = 0; i < n; i++) out[i] = (out[i] ?? 0) * 0.18;
  const put = (part: Float32Array, at: number, level: number) => {
    const fade = Math.max(1, Math.round(0.002 * rate));
    for (let i = 0; i < part.length && at + i < n - fade; i++) {
      const edge = Math.min(1, i / fade, (part.length - 1 - i) / fade);
      out[at + i] = (out[at + i] ?? 0) + (part[i] ?? 0) * level * Math.max(0, edge);
    }
  };
  // Crackles: a short burst of held noise every 40–140 ms.
  for (let t = 0.03; t < HUM_SECONDS - 0.05; t += 0.04 + rand() * 0.1) {
    put(
      noise(rate, 0.003 + rand() * 0.008, 2 + Math.floor(rand() * 6), rand),
      Math.round(t * rate),
      0.25 + rand() * 0.25,
    );
  }
  // Two or three stuttering chirps.
  for (let k = 0, count = 2 + Math.floor(rand() * 2); k < count; k++) {
    const f = 900 + rand() * 1500;
    const chirp = stutter(
      crushed(rate, 0.03, f, f * (0.6 + rand()), 3, 4),
      rate,
      0.012,
      2 + Math.floor(rand() * 3),
    );
    put(chirp, Math.round((0.1 + rand() * (HUM_SECONDS - 0.3)) * rate), 0.3);
  }
  return out;
}
