import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, THEME_FADE_MS } from "./applyTheme";
import { BUILTIN_THEMES } from "./themes";

function fakePage() {
  const props = new Map<string, string>();
  const root = {
    style: { setProperty: (n: string, v: string) => props.set(n, v) },
    dataset: {} as DOMStringMap,
  };
  const getComputedStyle = vi.fn();
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("getComputedStyle", getComputedStyle);
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  return { root, props, getComputedStyle };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("applyTheme (step 13: one restyle per change)", () => {
  it("an instant change declares no transition and forces no style read", () => {
    const { root, props, getComputedStyle } = fakePage();
    applyTheme(BUILTIN_THEMES[1]!, true);
    expect(root.dataset.themeFade).toBeUndefined();
    expect(getComputedStyle).not.toHaveBeenCalled();
    expect(props.has("transition")).toBe(false);
    expect(props.get("--bg-top")).toBe(BUILTIN_THEMES[1]!.bg[0]);
    expect(root.dataset.theme).toBe(BUILTIN_THEMES[1]!.id);
  });

  it("a cross-fade declares its transition for the fade only", () => {
    const { root } = fakePage();
    applyTheme(BUILTIN_THEMES[2]!, false);
    expect(root.dataset.themeFade).toBe("");
    vi.advanceTimersByTime(THEME_FADE_MS);
    expect(root.dataset.themeFade).toBeUndefined();
  });

  it("an instant change during a cross-fade ends it at once", () => {
    const { root } = fakePage();
    applyTheme(BUILTIN_THEMES[2]!, false);
    applyTheme(BUILTIN_THEMES[3]!, true);
    expect(root.dataset.themeFade).toBeUndefined();
  });
});
