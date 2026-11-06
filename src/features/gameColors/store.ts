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
  /** The last change plays the passage (false: the first selection, shown at once). */
  tide: boolean;
  /**
   * Step 16b: where the shown app's card is now (viewport px), kept current (selection, resize);
   * null when no app is shown. The atmosphere's focus target (`FxLayer.setFocusTarget`).
   */
  focus: FxTarget | null;
}

export const gameColorsStore = createStore<GameColorsState>()(() => ({
  shown: null,
  origin: null,
  since: 0,
  tide: false,
  focus: null,
}));

/** Same place to the pixel: an identical target is not written again (no render for nothing). */
function samePlace(a: FxTarget | null, b: FxTarget | null): boolean {
  if (!a || !b) return a === b;
  const px = (v: number) => Math.round(v);
  return px(a.x) === px(b.x) && px(a.top) === px(b.top) && px(a.bottom) === px(b.bottom);
}

/** Step 16b: the shown card moved (window resized, mode changed): `locate` gives its new place. */
export function refreshFocus(locate: () => FxTarget | null): void {
  const { shown, focus } = gameColorsStore.getState();
  const next = shown === null ? null : locate();
  if (!samePlace(focus, next)) gameColorsStore.setState({ focus: next });
}

let timer = 0;
let started = false;
/** 30/10: no change of colours before this time (`performance.now`): the tab dance's impact. */
let holdUntil = 0;

/** A sequence asks the colours to wait for its moment (the selected card's impact). */
export function holdGameColors(until: number): void {
  holdUntil = until;
}

/**
 * The home's selection (`null`: nothing selected). Its colours follow once it has rested
 * `GAME_COLORS.delay` ms (V8 b): each new selection restarts the wait, so a burst of arrows or a
 * held key never changes them; `wait: false` (setting « Tout de suite ») follows at once. The very
 * first selection shows at once, without a passage (the opening covers it). `locate` gives the
 * selected card's place when the wait ends.
 */
export function selectGame(id: string | null, locate: () => FxTarget | null, wait = true): void {
  window.clearTimeout(timer);
  const state = gameColorsStore.getState();
  if (!started) {
    started = true;
    const focus = id === null ? null : locate();
    gameColorsStore.setState({
      shown: id,
      origin: null,
      since: performance.now(),
      tide: false,
      focus,
    });
    return;
  }
  if (state.shown === id) return;
  const ms = Math.max(
    wait ? GAME_COLORS.delay / currentMotion().speed : 0,
    holdUntil - performance.now(),
  );
  timer = window.setTimeout(() => {
    const origin = locate();
    const focus = id === null ? null : origin;
    gameColorsStore.setState({ shown: id, origin, since: performance.now(), tide: true, focus });
  }, ms);
}

/** Tests: back to the state of a fresh start. */
export function resetGameColors(): void {
  window.clearTimeout(timer);
  started = false;
  holdUntil = 0;
  gameColorsStore.setState({ shown: null, origin: null, since: 0, tide: false, focus: null });
}
