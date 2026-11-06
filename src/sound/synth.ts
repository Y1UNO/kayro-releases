import type { Note, PackFx } from "./manifest";

/**
 * Step 17b, the synthesiser: a style's notes as oscillators with a short attack and an
 * exponential fade, through the style's effects (a filter, a soft echo). Works on the live audio
 * context and on an offline one (the wave drawn in the settings). Nothing is recorded: every
 * sound is made on the spot, original.
 */

/** A crystal bell's overtones: frequency ratio, level, length (× the note's). */
const BELL: readonly (readonly [number, number, number])[] = [
  [2.76, 0.28, 0.55],
  [5.4, 0.1, 0.3],
];

/** The style's chain: input → filter → dry + echo → `out`. Returns its input. */
export function fxChain(c: BaseAudioContext, fx: PackFx, out: AudioNode): AudioNode {
  const input = c.createGain();
  let head: AudioNode = input;
  if (fx.filter) {
    const f = c.createBiquadFilter();
    f.type = fx.filter.type;
    f.frequency.value = fx.filter.freq;
    f.Q.value = 0.7;
    head.connect(f);
    head = f;
  }
  head.connect(out);
  if (fx.echo) {
    const delay = c.createDelay(1);
    delay.delayTime.value = fx.echo.time;
    const feedback = c.createGain();
    feedback.gain.value = fx.echo.feedback;
    const wet = c.createGain();
    wet.gain.value = fx.echo.mix;
    head.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(out);
  }
  return input;
}

function voice(
  c: BaseAudioContext,
  wave: OscillatorType,
  freq: number,
  to: number | undefined,
  start: number,
  dur: number,
  attack: number,
  gain: number,
  out: AudioNode,
): void {
  const osc = c.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  const a = Math.min(attack, dur * 0.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + a);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/**
 * Schedules the notes from `t0` (s, the context's clock), at `gain`, pitched by `rate`, their
 * starts stretched by `timeScale` (a sound following an animation's own length).
 */
export function playNotes(
  c: BaseAudioContext,
  notes: readonly Note[],
  into: AudioNode,
  t0: number,
  gain: number,
  rate: number,
  timeScale = 1,
): void {
  for (const n of notes) {
    const start = t0 + (n.at ?? 0) * timeScale;
    const attack = n.attack ?? 0.004;
    const to = n.to === undefined ? undefined : n.to * rate;
    voice(c, n.wave, n.freq * rate, to, start, n.dur, attack, n.gain * gain, into);
    if (!n.bell) continue;
    for (const [ratio, level, length] of BELL) {
      voice(
        c,
        "sine",
        n.freq * rate * ratio,
        undefined,
        start,
        n.dur * length,
        attack,
        n.gain * gain * level,
        into,
      );
    }
  }
}

/** Peaks of a sound in `bars` slices (0–1, the loudest slice = 1): the wave of the settings. */
export function peaks(samples: Float32Array, bars: number): number[] {
  const out: number[] = [];
  const size = Math.max(1, Math.floor(samples.length / bars));
  for (let b = 0; b < bars; b++) {
    let m = 0;
    for (let i = b * size; i < Math.min(samples.length, (b + 1) * size); i++) {
      m = Math.max(m, Math.abs(samples[i] ?? 0));
    }
    out.push(m);
  }
  const top = Math.max(...out, 1e-6);
  return out.map((v) => v / top);
}
