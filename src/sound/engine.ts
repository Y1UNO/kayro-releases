import { cueGain, SILENT, type SoundPrefs } from "./gate";
import {
  cueLength,
  parseSoundManifest,
  type Note,
  type PackFx,
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
      // A sound that goes on (Kysland's) keeps the context awake.
      if (ownLoops.size === 0) void ctx?.suspend();
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

const ownChains = new Map<string, AudioNode>();
const ownLast = new Map<string, number>();

/**
 * Step 20: a sound of its own (Kysland's). Its notes and its effects are its own, not one of
 * the app's sound styles, and no family turns it off: only « Sons » on or off, the volume and
 * the window being on screen apply.
 */
export function playOwn(
  id: string,
  notes: readonly Note[],
  fx: PackFx,
  level: number,
  minGapMs = 0,
): void {
  const now = performance.now();
  if (!prefs.on || !visible || notes.length === 0) return;
  const last = ownLast.get(id);
  if (last !== undefined && now - last < minGapMs) return;
  const gain = level * Math.min(1, Math.max(0, prefs.volume));
  const c = context();
  if (gain <= 0 || !c || !master) return;
  ownLast.set(id, now);
  const key = JSON.stringify(fx);
  const into = ownChains.get(key) ?? fxChain(c, fx, master);
  ownChains.set(key, into);
  const length =
    Math.max(...notes.map((n) => (n.at ?? 0) + n.dur)) + (fx.echo ? fx.echo.time * 6 : 0);
  void (async () => {
    if (c.state !== "running") await c.resume().catch(() => undefined);
    playNotes(c, notes, into, c.currentTime + 0.005, gain, 1);
    sleepAfter(length);
  })();
}

/**
 * Step 20: a sound of its own made sample by sample (`make` gets the output's sample rate):
 * same rules as `playOwn`.
 */
export function playOwnSamples(
  id: string,
  make: (rate: number) => Float32Array<ArrayBuffer>,
  level: number,
  minGapMs = 0,
): void {
  const now = performance.now();
  if (!prefs.on || !visible) return;
  const last = ownLast.get(id);
  if (last !== undefined && now - last < minGapMs) return;
  const gain = level * Math.min(1, Math.max(0, prefs.volume));
  const c = context();
  if (gain <= 0 || !c || !master) return;
  ownLast.set(id, now);
  const data = make(c.sampleRate);
  if (data.length === 0) return;
  const buffer = c.createBuffer(1, data.length, c.sampleRate);
  buffer.copyToChannel(data, 0);
  const out = master;
  void (async () => {
    if (c.state !== "running") await c.resume().catch(() => undefined);
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = buffer;
    g.gain.value = gain;
    src.connect(g).connect(out);
    src.start();
    sleepAfter(data.length / c.sampleRate);
  })();
}

interface OwnLoop {
  src: AudioBufferSourceNode;
  gain: GainNode;
  level: number;
}
const ownLoops = new Map<string, OwnLoop>();

/**
 * Step 20: a sound of its own that goes on (Kysland across two screens, « Glitch »): `make`
 * gives a stretch of samples played in a loop, faded in; `stopOwnLoop` fades it out. It stops by
 * itself when sounds are turned off or the window leaves the screen.
 */
export function startOwnLoop(
  id: string,
  make: (rate: number) => Float32Array<ArrayBuffer>,
  level: number,
): void {
  if (ownLoops.has(id) || !prefs.on || !visible) return;
  const gain = level * Math.min(1, Math.max(0, prefs.volume));
  const c = context();
  if (gain <= 0 || !c || !master) return;
  const data = make(c.sampleRate);
  if (data.length === 0) return;
  const buffer = c.createBuffer(1, data.length, c.sampleRate);
  buffer.copyToChannel(data, 0);
  const src = c.createBufferSource();
  const g = c.createGain();
  src.buffer = buffer;
  src.loop = true;
  g.gain.value = 0.0001;
  src.connect(g).connect(master);
  ownLoops.set(id, { src, gain: g, level: gain });
  if (idle) clearTimeout(idle);
  idle = null;
  void (async () => {
    if (c.state !== "running") await c.resume().catch(() => undefined);
    src.start();
    g.gain.setTargetAtTime(gain, c.currentTime, 0.04);
  })();
}

/** Its loudness now, 0–1 of its level (the glitch's bursts swell it). */
export function setOwnLoop(id: string, share: number): void {
  const loop = ownLoops.get(id);
  if (!loop || !ctx) return;
  const to = loop.level * Math.min(1, Math.max(0, share));
  loop.gain.gain.setTargetAtTime(Math.max(to, 0.0001), ctx.currentTime, 0.05);
}

export function stopOwnLoop(id: string): void {
  const loop = ownLoops.get(id);
  if (!loop) return;
  ownLoops.delete(id);
  if (ctx) {
    loop.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    loop.src.stop(ctx.currentTime + 0.3);
  }
  if (ownLoops.size === 0) sleepAfter(0.35);
}

function stopOwnLoops(): void {
  for (const id of [...ownLoops.keys()]) stopOwnLoop(id);
}

export function configureSounds(next: SoundPrefs): void {
  prefs = next;
  if (!prefs.on) stopOwnLoops();
}

/** Off screen: nothing new plays (a sound already playing ends, then the context sleeps). */
export function setSoundsVisible(shown: boolean): void {
  visible = shown;
  if (!shown) stopOwnLoops();
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
