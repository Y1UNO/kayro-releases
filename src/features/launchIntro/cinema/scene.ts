/**
 * What every launch scene offers (30/10): `play` draws the moment `t` (ms from the start) given
 * when the game's window came up (`landed`) and when the user skipped (`skip`), and says whether
 * it ended, how much of the game's name and of the « skip » hint to show.
 */
export interface LaunchScene {
  play(t: number, landed: number | null, skip: number | null): SceneState;
  resize(): void;
  dispose(): void;
}

export interface SceneState {
  done: boolean;
  /** The finale has begun (step 17b: its sound starts with it). */
  finale: boolean;
  caption: number;
  hint: number;
}

/** Shared timing: the finale waits for the game (from `minHold`), never past the ceiling. */
export const TIMING = { minHold: 4600, ceiling: 10000, landedGrace: 400 } as const;

/** When a scene's finale (`finaleMs` long) starts. */
export function finaleAt(landed: number | null, skip: number | null, finaleMs: number): number {
  const latest = TIMING.ceiling - finaleMs;
  let at = latest;
  if (landed !== null) at = Math.max(TIMING.minHold, landed + TIMING.landedGrace);
  if (skip !== null) at = Math.min(at, skip);
  return Math.min(at, latest);
}
