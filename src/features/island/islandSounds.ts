import type { IslandPassage } from "../../ipc/bindings";
import { playOwn, playOwnSamples, setOwnLoop, startOwnLoop, stopOwnLoop } from "../../sound";
import { glitchHum, glitchVoice } from "./glitchVoice";
import type { Note, PackFx } from "../../sound/manifest";

/**
 * Step 20 (Kysland): the island's own sounds. They belong to it: the app's sound styles
 * (Premium, Rétro, Chiptune) and families do not change them; only « Sons » on or off and the
 * volume apply. Two sets, one per passage: « Forcer », glassy and round notes; « Glitch », made
 * sample by sample (glitchVoice.ts): crushed, noisy, stuttering.
 */
export type IslandSound = "detach" | "cross" | "dock" | "snap" | "open" | "close";

export const ISLAND_SOUNDS = ["detach", "cross", "dock", "snap", "open", "close"] as const;

const LEVEL: Record<IslandSound, number> = {
  detach: 0.6,
  cross: 0.6,
  dock: 0.65,
  snap: 0.5,
  open: 0.55,
  close: 0.5,
};

/** Crushed square waves at full scale are far louder than notes: brought to the same level. */
const GLITCH_LEVEL = 0.22;

/** « Forcer »: a little air and an echo, like glass. */
export const FORCE_FX: PackFx = {
  filter: { type: "highpass", freq: 220 },
  echo: { time: 0.13, feedback: 0.3, mix: 0.24 },
};

const sine = (freq: number, dur: number, gain: number, more: Partial<Note> = {}): Note => ({
  wave: "sine",
  freq,
  dur,
  gain,
  ...more,
});
export const ISLAND_NOTES: Record<"force", Record<IslandSound, Note[]>> = {
  force: {
    detach: [
      sine(440, 0.12, 0.09, { to: 880, attack: 0.004 }),
      sine(1760, 0.22, 0.05, { at: 0.06, bell: true }),
    ],
    cross: [
      sine(880, 0.09, 0.06, { to: 1318.5 }),
      sine(1661.2, 0.18, 0.05, { at: 0.05, bell: true }),
      sine(2217.5, 0.2, 0.04, { at: 0.1, bell: true }),
      sine(2960, 0.24, 0.03, { at: 0.15, bell: true }),
    ],
    dock: [
      sine(220, 0.16, 0.14, { to: 130.8, attack: 0.003 }),
      sine(1318.5, 0.28, 0.05, { at: 0.03, bell: true }),
    ],
    snap: [sine(2637, 0.06, 0.07, { bell: true })],
    open: [
      sine(659.25, 0.14, 0.05, { to: 1318.5, attack: 0.01 }),
      sine(1975.5, 0.3, 0.05, { at: 0.08, bell: true }),
    ],
    close: [
      sine(1318.5, 0.12, 0.045, { to: 659.25 }),
      sine(987.77, 0.2, 0.035, { at: 0.06, bell: true }),
    ],
  },
  // « Glitch » is made sample by sample (glitchVoice.ts): no notes.
};

/** Plays one of the island's own sounds, in the set of its passage. */
export function playIsland(sound: IslandSound, passage: IslandPassage): void {
  if (passage === "glitch") {
    const voice = (rate: number) => glitchVoice(sound, rate);
    playOwnSamples(`island.glitch.${sound}`, voice, LEVEL[sound] * GLITCH_LEVEL, 120);
    return;
  }
  playOwn(`island.${passage}.${sound}`, ISLAND_NOTES.force[sound], FORCE_FX, LEVEL[sound], 120);
}

const HUM = "island.glitch.hum";
/** The hum is quiet: it goes on as long as the island sits across two screens. */
const HUM_LEVEL = 0.5;

/** The edge's hum under the island: on while it glitches across two screens, louder in bursts. */
export function humIsland(on: boolean, level = 0): void {
  if (!on) {
    stopOwnLoop(HUM);
    return;
  }
  startOwnLoop(HUM, (rate) => glitchHum(rate), HUM_LEVEL * GLITCH_LEVEL);
  setOwnLoop(HUM, 0.55 + 0.45 * Math.min(1, level));
}
