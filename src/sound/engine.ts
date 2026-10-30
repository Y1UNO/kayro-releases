import { cueGain, SILENT, type SoundPrefs } from "./gate";
import { cueLength, parseSoundManifest, type SoundEvent, type SoundPackId } from "./manifest";
import manifestJson from "./sons.json";
import { fxChain, peaks, playNotes } from "./synth";

/**
 * Step 17b, the sound engine (Web Audio, synthesised: no file to load). The audio context only
 * runs while a sound plays: it is suspended right after (no audio thread at rest), and nothing
 * new plays while the window is off screen.
 */
const MANIFEST = parseSoundManifest(manifestJson);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const chains = new Map<SoundPackId, AudioNode>();
const lastPlayed = new Map<SoundEvent, number>();
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

function ring(event: SoundEvent, gain: number, pack: SoundPackId): void {
  const c = context();
  if (!c) return;
  const cue = MANIFEST.events[event];
  const start = async () => {
    if (c.state !== "running") await c.resume().catch(() => undefined);
    const rate = 1 + (Math.random() * 2 - 1) * cue.pitch;
    playNotes(
      c,
      MANIFEST.packs[pack].cues[event],
      chain(c, pack),
      c.currentTime + 0.005,
      gain,
      rate,
    );
    sleepAfter(cueLength(MANIFEST.packs[pack], event));
  };
  void start();
}

/** Plays a moment of the interface, if the settings and the window allow it. */
export function playSound(event: SoundEvent): void {
  const now = performance.now();
  const gain = cueGain(MANIFEST.events[event], prefs, visible, lastPlayed.get(event), now);
  if (gain === null) return;
  lastPlayed.set(event, now);
  ring(event, gain, prefs.pack);
}

/** The settings' preview: the chosen style and volume, even with a family turned off. */
export function previewSound(event: SoundEvent, pack: SoundPackId, volume: number): void {
  const gain = MANIFEST.events[event].volume * Math.min(1, Math.max(0, volume));
  if (gain > 0) ring(event, gain, pack);
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
    playNotes(
      off,
      MANIFEST.packs[pack].cues[event],
      fxChain(off, MANIFEST.packs[pack].fx, off.destination),
      0,
      1,
      1,
    );
    const buffer = await off.startRendering();
    return peaks(buffer.getChannelData(0), bars);
  } catch {
    return Array.from({ length: bars }, (_, i) => Math.exp(-i / (bars / 4)));
  }
}
