import { describe, expect, it } from "vitest";
import type { AppEntry } from "../../ipc/bindings";
import {
  fixedDelayMs,
  generateSteps,
  HEAVY_DELAY_MS,
  LIGHT_DELAY_MS,
  toSimple,
  type SimpleDraft,
} from "./simple";

function app(id: string, over: Partial<AppEntry> = {}): AppEntry {
  return {
    id,
    name: id,
    category: "logiciels",
    source: { kind: "manual" },
    launch: { kind: "exe", path: `C:\${id}.exe`, args: [], cwd: null, elevated: false },
    match: { exe: `${id}.exe` },
    art: { poster: null, hero: null },
    moodId: null,
    favorite: false,
    ...over,
  } as AppEntry;
}

const discord = app("discord");
const spotify = app("spotify");
const lnkApp = app("notes", {
  name: "Notes",
  launch: { kind: "lnk", path: "C:\notes.lnk" },
  match: { exe: null },
});
const steam = app("steam", {
  name: "Steam",
  launch: { kind: "uri", uri: "steam://open/main" },
  match: { exe: "steam.exe" },
});
const steamUntracked = app("steam-nomatch", {
  name: "Steam",
  launch: { kind: "uri", uri: "steam://open/main" },
  match: { exe: null },
});
const hades = app("hades", {
  name: "Hades",
  source: { kind: "steam", appId: "1145360" },
  launch: { kind: "uri", uri: "steam://rungameid/1145360" },
  match: { exe: null },
});
const apps = [discord, spotify, lnkApp, steam, steamUntracked, hades];
const ctx = { apps, links: {} };

const draft = (ids: string[], sequence: SimpleDraft["sequence"], ready = true): SimpleDraft => ({
  sequence,
  items: ids.map((appId) => ({ appId, ready })),
});

describe("generateSteps", () => {
  it("launches only, when nothing is to be waited for", () => {
    const { steps, links } = generateSteps(draft(["discord", "spotify"], "together", false), ctx);
    expect(steps).toEqual([
      { type: "launch", slot: "discord" },
      { type: "launch", slot: "spotify" },
    ]);
    expect(links).toEqual({ discord: "discord", spotify: "spotify" });
  });

  it("followed app: waitReady with a 30 s timeout, right after its launch (one by one)", () => {
    const { steps } = generateSteps(draft(["discord", "spotify"], "oneByOne"), ctx);
    expect(steps).toEqual([
      { type: "launch", slot: "discord" },
      { type: "waitReady", slot: "discord", timeoutMs: 30000 },
      { type: "launch", slot: "spotify" },
      { type: "waitReady", slot: "spotify", timeoutMs: 30000 },
    ]);
  });

  it("together: every launch first, the waits of the « ready » apps after", () => {
    const { steps } = generateSteps(draft(["discord", "spotify"], "together"), ctx);
    expect(steps.map((s) => s.type)).toEqual(["launch", "launch", "waitReady", "waitReady"]);
  });

  it("app that cannot be followed: a short fixed delay, none after the very last launch", () => {
    const { steps } = generateSteps(draft(["notes", "discord"], "oneByOne"), ctx);
    expect(steps[1]).toEqual({ type: "wait", ms: LIGHT_DELAY_MS });
    const last = generateSteps(draft(["discord", "notes"], "oneByOne"), ctx).steps;
    expect(last.at(-1)).toEqual({ type: "launch", slot: "notes" });
  });

  it("heavy launcher that cannot be followed: a longer delay", () => {
    expect(fixedDelayMs(steamUntracked)).toBe(HEAVY_DELAY_MS);
    expect(fixedDelayMs(lnkApp)).toBe(LIGHT_DELAY_MS);
    const { steps } = generateSteps(draft(["steam-nomatch", "discord"], "oneByOne"), ctx);
    expect(steps[1]).toEqual({ type: "wait", ms: HEAVY_DELAY_MS });
  });

  it("a Steam game needs no wait for Steam before it, and Steam itself is not required", () => {
    const { steps } = generateSteps(draft(["steam", "hades"], "oneByOne"), ctx);
    expect(steps).toEqual([
      { type: "launch", slot: "steam" },
      { type: "launch", slot: "hades" },
    ]);
    // A Steam game after something else keeps its normal wait.
    const other = generateSteps(draft(["discord", "hades"], "oneByOne"), ctx).steps;
    expect(other.map((s) => s.type)).toEqual(["launch", "waitReady", "launch"]);
  });

  it("an app that is already open is simply launched again (the engine brings it forward)", () => {
    // Nothing in the generated steps depends on what is running now: the scene stays the same.
    const a = generateSteps(draft(["discord"], "oneByOne", false), ctx).steps;
    expect(a).toEqual([{ type: "launch", slot: "discord" }]);
  });

  it("reuses the slot an app is already linked to and avoids a taken name", () => {
    const linked = generateSteps(draft(["discord"], "together", false), {
      apps,
      links: { messagerie: "discord" },
    });
    expect(linked.steps).toEqual([{ type: "launch", slot: "messagerie" }]);
    const taken = generateSteps(draft(["discord"], "together", false), {
      apps,
      links: { discord: "spotify" },
    });
    expect(taken.steps).toEqual([{ type: "launch", slot: "discord-2" }]);
    expect(taken.links["discord-2"]).toBe("discord");
  });

  it("ignores an app that no longer exists", () => {
    expect(generateSteps(draft(["ghost"], "together"), ctx).steps).toEqual([]);
  });
});

describe("toSimple (advanced → simple)", () => {
  const links = { discord: "discord", spotify: "spotify", notes: "notes" };
  const full = { apps, links };

  it("round-trips what the generator makes", () => {
    for (const sequence of ["oneByOne", "together"] as const) {
      const original = draft(["discord", "notes", "spotify"], sequence);
      const { steps, links: l } = generateSteps(original, full);
      const back = toSimple(steps, { apps, links: l });
      expect(back).not.toBeNull();
      expect(generateSteps(back!.draft, { apps, links: l }).steps).toEqual(steps);
    }
  });

  it("refuses steps the simple mode cannot make", () => {
    const base = { apps, links };
    const bad = [
      [
        { type: "launch", slot: "discord" },
        { type: "wait", ms: 1234 },
      ],
      [
        { type: "launch", slot: "discord" },
        { type: "focus", slot: "discord" },
      ],
      [{ type: "launch", slot: "discord", required: true }],
      [{ type: "close", slot: "discord" }],
      [
        { type: "launch", slot: "discord" },
        { type: "launch", slot: "discord" },
      ],
      [{ type: "launch", slot: "nowhere" }],
      [{ type: "wait", ms: 2000 }],
      [],
    ] as const;
    for (const steps of bad) expect(toSimple(steps, base), JSON.stringify(steps)).toBeNull();
  });
});
