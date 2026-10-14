import { createStore } from "zustand";
import { currentMotion } from "../../design/motion/current";
import { GAME_COLORS } from "../../design/motion/tokens14";
import type { FxTarget } from "../../fx";

/** Which app's colours are shown, and how the last change came (step 14). */
export interface GameColorsState {
  /** App whose colours are shown; null = the theme's (the fan, another screen). */
  shown: string | null;
  /** Centre of the selected card when the change came (viewport px): where the tide starts. */
  origin: FxTarget | null;
  /** Time (`performance.now`) the shown app changed. */
  since: number;
  /** The last change plays the tide (false: the first selection, shown at once). */
  tide: boolean;
}

export const gameColorsStore = createStore<GameColorsState>()(() => ({
  shown: null,
  origin: null,
  since: 0,
  tide: false,
}));

let timer = 0;
let started = false;

/**
 * The home's selection (`null`: nothing selected). Its colours follow once it has rested
 * `GAME_COLORS.delay` ms (V8 b): each new selection restarts the wait, so a burst of arrows or a
 * held key never changes them. The very first selection shows at once, without a tide (the opening
 * covers it). `locate` gives the selected card's place when the wait ends.
 */
export function selectGame(id: string | null, locate: () => FxTarget | null): void {
  window.clearTimeout(timer);
  const state = gameColorsStore.getState();
  if (!started) {
    started = true;
    gameColorsStore.setState({ shown: id, origin: null, since: performance.now(), tide: false });
    return;
  }
  if (state.shown === id) return;
  const wait = GAME_COLORS.delay / currentMotion().speed;
  timer = window.setTimeout(() => {
    gameColorsStore.setState({ shown: id, origin: locate(), since: performance.now(), tide: true });
  }, wait);
}

/** Tests: back to the state of a fresh start. */
export function resetGameColors(): void {
  window.clearTimeout(timer);
  started = false;
  gameColorsStore.setState({ shown: null, origin: null, since: 0, tide: false });
}
