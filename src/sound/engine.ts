import { cueGain, SILENT, type SoundPrefs } from "./gate";
import {
  cueLength,
  parseSoundManifest,
  type Note,
  type SoundEvent,
  type SoundPackId,
} from "./manifest";
import manifestJson from "./sons.json";
import { fxChain, peaks, playNotes } from "./synth";

/**
 * Step 17b, the sound engine (Web Audio, synthesised: no file to load). The audio context only
 * runs while a sound plays: it is suspended right after (no audio thread at rest), and nothing
 * new plays while the window is off screen.
 */
const MANIFEST = parseSoundManifest(manifestJson);

/** How a moment follows what is on screen. */
export interface PlayOptions {
  /** Step on a pentatonic scale (the card under the pointer, the step of a scene): 0 = as written. */
  degree?: number;
  /** Its notes' starts stretched (the animation's own length over the written one). */
  timeScale?: number;
  /** Starts later (s), on the audio clock: a sound placed on a moment of an animation. */
  delay?: number;
}

const PENTATONIC = [0, 2, 4, 7, 9];

/** The pitch ratio of a degree of the pentatonic scale (5 a degree per octave, either way). */
export function degreeRate(degree: number): number {
  const octave = Math.floor(degree / 5);
  const step = PENTATONIC[((degree % 5) + 5) % 5] ?? 0;
  return 2 ** ((step + 12 * octave) / 12);
}

/** A variant other than the last one played (when there are several). */
export function pickVariant(
  count: number,
  last: number | undefined,
  random = Math.random(),
): number {
  if (count <= 1) return 0;
  const k = Math.floor(random * (count - 1));
  return last === undefined || k < last ? k : k + 1;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const chains = new Map<SoundPackId, AudioNode>();
const lastPlayed = new Map<SoundEvent, number>();
const lastVariant = new Map<SoundEvent, number>();
const live = new Map<SoundEvent, Set<GainNode>>();
let prefs: SoundPrefs = SILENT;
let visible = true;
let busyUntil = 0;
let idle: ReturnType<typeof setTimeout> | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.connect(ctx.destination);
  } catch {
    ctx = null; // no audio output: the interface stays silent
  }
  return ctx;
}

function chain(c: AudioContext, pack: SoundPackId): AudioNode {
  let input = chains.get(pack);
  if (!input && master) {
    input = fxChain(c, MANIFEST.packs[pack].fx, master);
    chains.set(pack, input);
  }
  return input ?? c.destination;
}

/** The context sleeps once the last sound (and its echo) has ended. */
function sleepAfter(seconds: number): void {
  busyUntil = Math.max(busyUntil, performance.now() + seconds * 1000);
  if (idle) clearTimeout(idle);
  idle = setTimeout(
    () => {
      idle = null;
      void ctx?.suspend();
    },
    busyUntil - performance.now() + 300,
  );
}

function variantOf(event: SoundEvent, pack: SoundPackId): Note[] {
  const list = MANIFEST.packs[pack].cues[event];
  const k = pickVariant(list.length, lastVariant.get(event));
  lastVariant.set(event, k);
  return list[k] ?? list[0] ?? [];
}

function ring(event: SoundEvent, gain: number, pack: SoundPackId, opts: PlayOptions): void {
  const c = context();
  if (!c || !master) return;
  const cue = MANIFEST.events[event];
  const notes = variantOf(event, pack);
  const scale = opts.timeScale ?? 1;
  const delay = Math.max(0, opts.delay ?? 0);
  const start = async () => {
    if (c.state !== "running") await c.resume().catch(() => undefined);
    const jitter = 1 + (Math.random() * 2 - 1) * cue.pitch;
    const rate = jitter * (opts.degree === undefined ? 1 : degreeRate(opts.degree));
    const level = c.createGain();
    level.connect(chain(c, pack));
    playNotes(c, notes, level, c.currentTime + 0.005 + delay, gain, rate, scale);
    const length = delay + cueLength(MANIFEST.packs[pack], event, scale);
    const set = live.get(event) ?? new Set<GainNode>();
    set.add(level);
    live.set(event, set);
    setTimeout(() => set.delete(level), length * 1000 + 100);
    sleepAfter(length);
  };
  void start();
}

/** Plays a moment of the interface, if the settings and the window allow it. */
export function playSound(event: SoundEvent, opts: PlayOptions = {}): void {
  const now = performance.now();
  const gain = cueGain(MANIFEST.events[event], prefs, visible, lastPlayed.get(event), now);
  if (gain === null) return;
  lastPlayed.set(event, now);
  ring(event, gain, prefs.pack, opts);
}

/** Fades out what is playing or scheduled of a moment (its animation was cut short). */
export function stopSound(event: SoundEvent): void {
  const set = live.get(event);
  if (!set || !ctx) return;
  for (const level of set) {
    level.gain.cancelScheduledValues(ctx.currentTime);
    level.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
  }
  set.clear();
}

/** The settings' preview: the chosen style and volume, even with a family turned off. */
export function previewSound(event: SoundEvent, pack: SoundPackId, volume: number): void {
  const gain = MANIFEST.events[event].volume * Math.min(1, Math.max(0, volume));
  if (gain > 0) ring(event, gain, pack, {});
}

export function configureSounds(next: SoundPrefs): void {
  prefs = next;
}

/** Off screen: nothing new plays (a sound already playing ends, then the context sleeps). */
export function setSoundsVisible(shown: boolean): void {
  visible = shown;
}

/** The wave of a style's moment, `bars` peaks (0–1), rendered offline (the settings' slider). */
export async function soundWave(
  pack: SoundPackId,
  event: SoundEvent,
  bars: number,
): Promise<number[]> {
  const rate = 22_050;
  const length = Math.ceil(cueLength(MANIFEST.packs[pack], event) * rate);
  try {
    const off = new OfflineAudioContext(1, length, rate);
    const into = fxChain(off, MANIFEST.packs[pack].fx, off.destination);
    playNotes(off, MANIFEST.packs[pack].cues[event][0] ?? [], into, 0, 1, 1);
    const buffer = await off.startRendering();
    return peaks(buffer.getChannelData(0), bars);
  } catch {
    return Array.from({ length: bars }, (_, i) => Math.exp(-i / (bars / 4)));
  }
}
