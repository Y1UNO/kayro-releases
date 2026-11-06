import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FxTarget } from "../../fx";
import { gameColorsStore, refreshFocus, resetGameColors, selectGame } from "./store";

const at = (x: number): FxTarget => ({ x, top: 300, bottom: 628 });

describe("focus target of the shown card (step 16b)", () => {
  beforeEach(() => {
    // Node runs the tests: the store's timers are the window's in the page.
    vi.stubGlobal("window", globalThis);
    vi.useFakeTimers();
    resetGameColors();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("follows the first selection at once, then each rested one", () => {
    selectGame("a", () => at(640));
    expect(gameColorsStore.getState().focus).toEqual(at(640));
    selectGame("b", () => at(700), false);
    vi.runAllTimers();
    expect(gameColorsStore.getState()).toMatchObject({ shown: "b", focus: at(700), tide: true });
  });

  it("is null when no app is shown", () => {
    selectGame("a", () => at(640));
    selectGame(null, () => at(1), false);
    vi.runAllTimers();
    expect(gameColorsStore.getState().focus).toBeNull();
    refreshFocus(() => at(5));
    expect(gameColorsStore.getState().focus).toBeNull();
  });

  it("moves with the card, and writes nothing for the same pixel", () => {
    selectGame("a", () => at(640));
    const before = gameColorsStore.getState();
    refreshFocus(() => ({ ...at(640), x: 640.3 }));
    expect(gameColorsStore.getState()).toBe(before);
    refreshFocus(() => at(960));
    expect(gameColorsStore.getState().focus).toEqual(at(960));
  });
});
