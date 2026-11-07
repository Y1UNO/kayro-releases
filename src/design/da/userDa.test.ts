import { describe, expect, it } from "vitest";
import {
  SOUND_DEFAULTS,
  UPDATE_DEFAULTS,
  VISUAL_DEFAULTS,
  DETECT_DEFAULTS,
} from "../../features/settings/settingsModel";
import type { Settings } from "../../ipc/bindings";
import { motionTokens } from "../motion/tokens";
import { sameUserChoices, userOverrides, withUser } from "./userDa";
import { defaultValues } from "./values";

const S: Settings = {
  ...VISUAL_DEFAULTS,
  ...SOUND_DEFAULTS,
  ...UPDATE_DEFAULTS,
  ...DETECT_DEFAULTS,
  openingScreen: "last",
  schemaVersion: 2,
  themeId: "bleu-gris",
  colorMode: "light",
  hotkey: "Ctrl+Alt+H",
  searchHotkey: "Ctrl+Alt+K",
  keyboardLayout: "auto",
  language: "fr",
  displayMode: "immersive",
  islandAlways: true,
  islandTuck: false,
  islandTuckDelay: 1.5,
  islandPeekDelay: 0.1,
  islandMusic: false,
  musicBass: 1,
  musicCrash: 1,
  musicTrails: 0.6,
  musicGloss: 0,
  musicSenseKick: 1,
  musicSenseSnare: 1,
  musicSenseHat: 1,
  musicSenseCrash: 1,
  musicDelayMs: 0,
  musicQuality: "auto",
  musicDemo: false,
  musicColors: "cover",
  hideOnEscape: true,
  hideOnBlur: false,
  economyMode: false,
};

describe("settings → art direction (round 5)", () => {
  it("the defaults are the validated direction", () => {
    const v = withUser(defaultValues(), S);
    expect(v.opening).toMatchObject({ on: true, pulse: "c" });
    expect(v.motion).toMatchObject({
      widgetMotion: "deroule",
      widgetSpring: "normale",
      style: "lively",
    });
    expect(v.categoryHover?.float).toBe("visible");
    expect(v.cardHover?.style).toBe("full");
    expect([v.bokeh?.on, v.embers?.on, v.stars?.on, v.cursorLight?.on]).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("maps each choice", () => {
    const o = userOverrides({
      ...S,
      openingStyle: "classic",
      widgetUnroll: "sober",
      widgetSpring: "strong",
      cardFloat: "none",
      particles: false,
    });
    expect(o.opening).toEqual({ on: true, pulse: "v1a" });
    expect(o.motion).toMatchObject({ widgetMotion: "sobre", widgetSpring: "forte" });
    expect(o.categoryHover).toEqual({ float: "none" });
    expect([o.embers?.on, o.stars?.on]).toEqual([false, false]);
    expect(userOverrides({ ...S, openingStyle: "none" }).opening?.on).toBe(false);
  });

  it("never switches on what the direction switched off", () => {
    const base = defaultValues();
    const off = { ...base, bokeh: { ...base.bokeh!, on: false } };
    expect(withUser(off, S).bokeh?.on).toBe(false);
    expect(withUser(base, null)).toBe(base);
  });

  it("knows when nothing the direction uses changed", () => {
    expect(sameUserChoices(S, { ...S, hotkey: "Ctrl+Alt+K" })).toBe(true);
    expect(sameUserChoices(S, { ...S, cardFloat: "strong" })).toBe(false);
  });

  it("« Net » takes the bounce out of every move (the entrance curve)", () => {
    const crisp = motionTokens({ ...defaultValues().motion!, style: "crisp" });
    expect(crisp.style).toBe("crisp");
    expect(crisp.ease.move).toBe(crisp.ease.in);
    expect(crisp.ease.bounce).toBe(crisp.ease.in);
    const lively = motionTokens(defaultValues().motion);
    expect(lively.ease.bounce).not.toBe(lively.ease.in);
  });
});
