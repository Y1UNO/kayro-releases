import type { SoundCue, SoundFamily, SoundPackId } from "./manifest";

/** What the user chose (Réglages › Sons). */
export interface SoundPrefs {
  on: boolean;
  pack: SoundPackId;
  /** 0–1. */
  volume: number;
  families: Record<SoundFamily, boolean>;
}

/** Until the settings are read: nothing plays. */
export const SILENT: SoundPrefs = {
  on: false,
  pack: "premium",
  volume: 0,
  families: { interface: false, transitions: false, launch: false },
};

/**
 * Whether a moment plays now, and how loud (its own volume × the user's): null when sounds are
 * off, its family is off, the window is not on screen, or it played less than `minGapMs` ago.
 */
export function cueGain(
  cue: SoundCue,
  prefs: SoundPrefs,
  visible: boolean,
  lastAt: number | undefined,
  now: number,
): number | null {
  if (!prefs.on || !prefs.families[cue.family] || !visible) return null;
  if (lastAt !== undefined && now - lastAt < cue.minGapMs) return null;
  const gain = cue.volume * Math.min(1, Math.max(0, prefs.volume));
  return gain > 0 ? gain : null;
}
