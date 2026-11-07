/**
 * Step 17b, the sounds' manifest (`sons.json`). For each moment of the interface: its family
 * (each can be turned off), its volume, the shortest gap between two plays and a small random
 * pitch change (no « broken record »). For each style (premium, retro, chiptune): its effects and,
 * per moment, the notes the synthesiser plays. Strict: only the known moments, styles, waves and
 * bounded numbers; nothing else can be written in it.
 */
export const SOUND_EVENTS = [
  "click",
  "select",
  "hover",
  "step",
  "toggle",
  "dialogOpen",
  "dialogClose",
  "tab",
  "land",
  "link",
  "linkBack",
  "confirm",
  "success",
  "error",
  "export",
  "progress",
  "theme",
  "open",
  "launch",
  "launchFinale",
] as const;
export type SoundEvent = (typeof SOUND_EVENTS)[number];

export const SOUND_PACKS = ["premium", "retro", "chiptune"] as const;
export type SoundPackId = (typeof SOUND_PACKS)[number];

export const SOUND_FAMILIES = ["interface", "transitions", "launch"] as const;
export type SoundFamily = (typeof SOUND_FAMILIES)[number];

const WAVES = ["sine", "triangle", "square", "sawtooth"] as const;

export interface SoundCue {
  family: SoundFamily;
  /** 0–1, before the user's volume. */
  volume: number;
  /** Shortest time between two plays of this moment (ms, 0–10 000). */
  minGapMs: number;
  /** Random pitch change, ± this fraction (0–0.1). */
  pitch: number;
}

/** One synthesised note: a wave from `freq` (to `to`, gliding), starting `at` s, lasting `dur` s. */
export interface Note {
  wave: (typeof WAVES)[number];
  freq: number;
  to?: number;
  at?: number;
  dur: number;
  attack?: number;
  gain: number;
  /** Glass-like overtones (× 2.76 and × 5.4, shorter): a crystal bell. */
  bell?: boolean;
}

export interface PackFx {
  filter?: { type: "lowpass" | "highpass"; freq: number };
  echo?: { time: number; feedback: number; mix: number };
}

export interface SoundPack {
  fx: PackFx;
  /** Per moment, one or a few variants (one is picked at random, never the same twice). */
  cues: Record<SoundEvent, Note[][]>;
}

export interface SoundManifest {
  schemaVersion: 1;
  events: Record<SoundEvent, SoundCue>;
  packs: Record<SoundPackId, SoundPack>;
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(where: string, what: string): never {
  throw new Error(`sons.json, ${where} : ${what}`);
}

/** Only these keys; every one of `required` present. */
function keys(where: string, v: unknown, allowed: string[], required = allowed): Obj {
  if (!isObj(v)) fail(where, "entrée invalide");
  const extra = Object.keys(v).find((k) => !allowed.includes(k));
  if (extra) fail(where, `champ inconnu « ${extra} »`);
  const missing = required.find((k) => !(k in v));
  if (missing) fail(where, `champ manquant « ${missing} »`);
  return v;
}

function num(where: string, v: unknown, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
    fail(where, `nombre hors de ${min}–${max}`);
  }
  return v;
}

function oneOf<T extends string>(where: string, v: unknown, list: readonly T[]): T {
  if (!list.includes(v as T)) fail(where, "valeur inconnue");
  return v as T;
}

function cue(where: string, v: unknown): SoundCue {
  const o = keys(where, v, ["family", "volume", "minGapMs", "pitch"]);
  return {
    family: oneOf(`${where}.family`, o.family, SOUND_FAMILIES),
    volume: num(`${where}.volume`, o.volume, 0, 1),
    minGapMs: num(`${where}.minGapMs`, o.minGapMs, 0, 10_000),
    pitch: num(`${where}.pitch`, o.pitch, 0, 0.1),
  };
}

function note(where: string, v: unknown): Note {
  const all = ["wave", "freq", "to", "at", "dur", "attack", "gain", "bell"];
  const o = keys(where, v, all, ["wave", "freq", "dur", "gain"]);
  const n: Note = {
    wave: oneOf(`${where}.wave`, o.wave, WAVES),
    freq: num(`${where}.freq`, o.freq, 40, 8000),
    dur: num(`${where}.dur`, o.dur, 0.01, 4),
    gain: num(`${where}.gain`, o.gain, 0, 0.5),
  };
  if (o.to !== undefined) n.to = num(`${where}.to`, o.to, 40, 8000);
  if (o.at !== undefined) n.at = num(`${where}.at`, o.at, 0, 4);
  if (o.attack !== undefined) n.attack = num(`${where}.attack`, o.attack, 0.001, 1);
  if (o.bell !== undefined) {
    if (typeof o.bell !== "boolean") fail(`${where}.bell`, "vrai ou faux attendu");
    n.bell = o.bell;
  }
  return n;
}

/** A list of notes, or a list of 2–4 variants (lists of notes). */
function variants(where: string, v: unknown): Note[][] {
  if (!Array.isArray(v) || v.length === 0) fail(where, "notes attendues");
  const many = Array.isArray(v[0]);
  const lists = (many ? v : [v]) as unknown[];
  if (many && lists.length > 4) fail(where, "4 variantes au plus");
  return lists.map((list, k) => {
    const at = many ? `${where}[${k}]` : where;
    if (!Array.isArray(list) || list.length === 0 || list.length > 16) {
      fail(at, "1 à 16 notes attendues");
    }
    return list.map((n, i) => note(`${at}[${i}]`, n));
  });
}

function pack(where: string, v: unknown): SoundPack {
  const o = keys(where, v, ["fx", "cues"]);
  const fx = keys(`${where}.fx`, o.fx, ["filter", "echo"], []);
  const out: PackFx = {};
  if (fx.filter !== undefined) {
    const f = keys(`${where}.fx.filter`, fx.filter, ["type", "freq"]);
    out.filter = {
      type: oneOf(`${where}.fx.filter.type`, f.type, ["lowpass", "highpass"] as const),
      freq: num(`${where}.fx.filter.freq`, f.freq, 20, 20_000),
    };
  }
  if (fx.echo !== undefined) {
    const e = keys(`${where}.fx.echo`, fx.echo, ["time", "feedback", "mix"]);
    out.echo = {
      time: num(`${where}.fx.echo.time`, e.time, 0.01, 1),
      feedback: num(`${where}.fx.echo.feedback`, e.feedback, 0, 0.7),
      mix: num(`${where}.fx.echo.mix`, e.mix, 0, 1),
    };
  }
  const cues = keys(`${where}.cues`, o.cues, [...SOUND_EVENTS]);
  const notes = {} as Record<SoundEvent, Note[][]>;
  for (const e of SOUND_EVENTS) notes[e] = variants(`${where}.cues.${e}`, cues[e]);
  return { fx: out, cues: notes };
}

/** The manifest, checked; throws on anything unexpected. */
export function parseSoundManifest(raw: unknown): SoundManifest {
  const o = keys("racine", raw, ["schemaVersion", "events", "packs"]);
  if (o.schemaVersion !== 1) fail("schemaVersion", "version inconnue");
  const ev = keys("events", o.events, [...SOUND_EVENTS]);
  const pk = keys("packs", o.packs, [...SOUND_PACKS]);
  const events = {} as Record<SoundEvent, SoundCue>;
  for (const e of SOUND_EVENTS) events[e] = cue(`events.${e}`, ev[e]);
  const packs = {} as Record<SoundPackId, SoundPack>;
  for (const p of SOUND_PACKS) packs[p] = pack(`packs.${p}`, pk[p]);
  return { schemaVersion: 1, events, packs };
}

/** How long a moment rings (s), its echo tail included (`timeScale`: its notes' starts stretched). */
export function cueLength(p: SoundPack, event: SoundEvent, timeScale = 1): number {
  const end = Math.max(...p.cues[event].flat().map((n) => (n.at ?? 0) * timeScale + n.dur));
  const echo = p.fx.echo;
  const tail = echo
    ? echo.time * Math.ceil(Math.log(0.01) / Math.log(Math.max(echo.feedback, 0.01)))
    : 0;
  return end + Math.min(tail, 1.5);
}
