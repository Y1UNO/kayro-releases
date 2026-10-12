import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { motionTokens } from "../../design/motion/tokens";
import type { ModePassage } from "../../ipc/bindings";
import { passagePlan } from "./passage";
import {
  ENTER_FALLBACK_MS,
  PassageDriver,
  resizeOrTimeout,
  waitsForSize,
  type PassageIo,
} from "./passageDriver";

const animated = passagePlan(motionTokens(undefined), false, false);

/** A page whose effects are recorded; fade-outs and waits resolve at once. */
function fakeIo(opening = false) {
  const log: string[] = [];
  const page = { inert: false };
  const io: PassageIo = {
    plan: () => animated,
    size: () => ({ w: 1280, h: 760 }),
    fadeOut: async () => null,
    faded: (id) => void log.push(`faded ${id}`),
    settled: async (_b, resized) => void log.push(`settled ${resized}`),
    frame: async () => {},
    comeIn: (_p, instant) => void log.push(instant ? "in at once" : "in"),
    openingOwnsEntrance: () => opening,
    setInert: (on) => void (page.inert = on),
  };
  return { io, log, page };
}

const ev = (id: number, step: "out" | "in", resized = false): ModePassage => ({
  id,
  step,
  label: "main",
  resized,
});

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

describe("passage driver (review A4–A6)", () => {
  it("a passage asked twice: only the « in » of the last « out » brings the page back", async () => {
    const { io, log } = fakeIo();
    const d = new PassageDriver("main", io, false);
    d.onPassage(ev(1, "out"));
    d.onPassage(ev(2, "out"));
    await flush();
    expect(log).toEqual(["faded 1", "faded 2"]);
    d.onPassage(ev(1, "in", true)); // the replaced passage: ignored
    await flush();
    expect(log).not.toContain("in");
    d.onPassage(ev(2, "in", true));
    await flush();
    expect(log.slice(2)).toEqual(["settled true", "in"]);
    // Done: a late repeat does not fade the page in a second time.
    d.onPassage(ev(2, "in"));
    await flush();
    expect(log.filter((l) => l === "in")).toHaveLength(1);
    d.dispose();
  });

  it("the core's size flag reaches the wait; a page of another window is left alone", async () => {
    const { io, log } = fakeIo();
    const d = new PassageDriver("main", io, false);
    d.onPassage({ ...ev(3, "out"), label: "widget" });
    d.onPassage(ev(4, "out"));
    await flush();
    d.onPassage(ev(4, "in", false));
    await flush();
    expect(log).toEqual(["faded 4", "settled false", "in"]);
    d.dispose();
  });

  it("never left faded out: without the core's « in », back after the fallback delay", async () => {
    const { io, log } = fakeIo();
    const d = new PassageDriver("main", io, false);
    d.onPassage(ev(5, "out"));
    await vi.advanceTimersByTimeAsync(ENTER_FALLBACK_MS - 1);
    expect(log).toEqual(["faded 5"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(log).toEqual(["faded 5", "in"]);
    // The core's « in » arriving after that does not play the entrance again.
    d.onPassage(ev(5, "in"));
    await flush();
    expect(log.filter((l) => l === "in")).toHaveLength(1);
    d.dispose();
  });

  it("built for a passage: in on the first show, at once when the opening plays", async () => {
    const plain = fakeIo(false);
    const d1 = new PassageDriver("main", plain.io, true);
    d1.shown();
    d1.shown();
    await flush();
    expect(plain.log).toEqual(["in"]);
    // Start in widget mode, then « ↗ »: the opening is due, it brings the page in itself.
    const opening = fakeIo(true);
    const d2 = new PassageDriver("main", opening.io, true);
    d2.shown();
    await flush();
    expect(opening.log).toEqual(["in at once"]);
    d1.dispose();
    d2.dispose();
  });

  it("built for a passage and never shown: in anyway after the fallback delay", async () => {
    const { io, log } = fakeIo();
    const d = new PassageDriver("main", io, true);
    await vi.advanceTimersByTimeAsync(ENTER_FALLBACK_MS);
    expect(log).toEqual(["in"]);
    d.dispose();
  });
});

describe("passage driver: no input while away, fallbacks (review B8, B12)", () => {
  it("the page is inert from « out » until it comes back", async () => {
    const { io, page } = fakeIo();
    const d = new PassageDriver("main", io, false);
    d.onPassage(ev(7, "out"));
    expect(page.inert).toBe(true);
    await flush();
    expect(page.inert).toBe(true); // faded out, the window is changing
    d.onPassage(ev(7, "in"));
    await flush();
    expect(page.inert).toBe(false);
    d.dispose();
  });

  it("an instant change never makes the page inert; the fallback and unmounting release it", async () => {
    const instant = fakeIo();
    instant.io.plan = () => ({ ...animated, instant: true });
    const d1 = new PassageDriver("main", instant.io, false);
    d1.onPassage(ev(8, "out"));
    expect(instant.page.inert).toBe(false);
    d1.dispose();

    const lost = fakeIo();
    const d2 = new PassageDriver("main", lost.io, false);
    d2.onPassage(ev(9, "out"));
    await vi.advanceTimersByTimeAsync(ENTER_FALLBACK_MS);
    expect(lost.page.inert).toBe(false); // the core's « in » never came
    d2.onPassage(ev(10, "out"));
    d2.dispose();
    expect(lost.page.inert).toBe(false);
    // Unmounted: its timers are gone, nothing comes in later.
    await vi.advanceTimersByTimeAsync(ENTER_FALLBACK_MS);
    expect(lost.log.filter((l) => l === "in")).toHaveLength(1);
  });

  it("an « out » during the fallback wait of a previous one restarts the wait", async () => {
    const { io, log } = fakeIo();
    const d = new PassageDriver("main", io, false);
    d.onPassage(ev(11, "out"));
    await vi.advanceTimersByTimeAsync(ENTER_FALLBACK_MS - 100);
    d.onPassage(ev(12, "out"));
    await vi.advanceTimersByTimeAsync(200);
    expect(log).not.toContain("in"); // the first fallback was cancelled
    await vi.advanceTimersByTimeAsync(ENTER_FALLBACK_MS);
    expect(log.filter((l) => l === "in")).toHaveLength(1);
    d.dispose();
  });
});

describe("waiting for the new size (review A5)", () => {
  it("waits only when the core says the size changes and the page does not have it yet", () => {
    const s = { w: 1280, h: 760 };
    expect(waitsForSize(s, s, false)).toBe(false);
    expect(waitsForSize(s, s, true)).toBe(true);
    expect(waitsForSize(s, { w: 1707, h: 960 }, true)).toBe(false);
  });

  it("the resize listener is removed whether the size came or the wait ran out", async () => {
    const listeners = new Set<unknown>();
    const target = {
      addEventListener: (_t: string, f: unknown) => void listeners.add(f),
      removeEventListener: (_t: string, f: unknown) => void listeners.delete(f),
    };
    const timedOut = resizeOrTimeout(target, 300);
    expect(listeners.size).toBe(1);
    await vi.advanceTimersByTimeAsync(300);
    await timedOut;
    expect(listeners.size).toBe(0);
    const resized = resizeOrTimeout(target, 300);
    for (const f of [...listeners]) (f as () => void)();
    await resized;
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
