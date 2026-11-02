import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anim } from "./islandShape";
import { SHOWN_AT_LEAST_MS, Tucker, tuckSprings, tuckedAway, type TuckPhase } from "./islandTuck";

/** A tucker with a fake engine and core; `allow`: what the core answers when it goes in. */
function setup(allow = true) {
  const drawn: boolean[] = [];
  const told: boolean[] = [];
  const phases: TuckPhase[] = [];
  const t = new Tucker({
    draw: (into) => drawn.push(into),
    tell: (into) => {
      told.push(into);
      return Promise.resolve(into ? allow : true);
    },
    onPhase: (p) => phases.push(p),
  });
  return { t, drawn, told, phases };
}

describe("« Cacher l'île »", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("goes in once left alone for the delay, and tells the core once nothing shows", async () => {
    const { t, drawn, told } = setup();
    t.setDelay(1500);
    t.update({ enabled: true });
    // Just shown: it stays a moment (here the delay is longer).
    vi.advanceTimersByTime(1499);
    expect(drawn).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(drawn).toEqual([true]);
    expect(t.phase).toBe("going");
    t.settled(false); // still moving: nothing yet
    expect(told).toEqual([]);
    t.settled(true);
    await Promise.resolve();
    expect(told).toEqual([true]);
    expect(t.phase).toBe("in");
  });

  it("waits while the pointer is on it, then the whole delay again", () => {
    const { t, drawn } = setup();
    t.setDelay(1000);
    t.update({ enabled: true });
    vi.advanceTimersByTime(SHOWN_AT_LEAST_MS - 100);
    t.update({ hovered: true });
    vi.advanceTimersByTime(5000);
    expect(drawn).toEqual([]);
    t.update({ hovered: false });
    vi.advanceTimersByTime(999);
    expect(drawn).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(drawn).toEqual([true]);
  });

  it("never goes in floating, opened, moved or announcing a launch", () => {
    for (const change of [
      { docked: false },
      { open: true },
      { moving: true },
      { stretched: true },
    ]) {
      const { t, drawn } = setup();
      t.update({ enabled: true, ...change });
      vi.advanceTimersByTime(10_000);
      expect(drawn, JSON.stringify(change)).toEqual([]);
    }
  });

  it("comes back under the pointer while going in", () => {
    const { t, drawn, told } = setup();
    t.setDelay(0);
    t.update({ enabled: true });
    vi.advanceTimersByTime(SHOWN_AT_LEAST_MS);
    t.update({ hovered: true });
    expect(drawn).toEqual([true, false]);
    expect(told).toEqual([]);
    expect(t.phase).toBe("out");
  });

  it("comes out for a launch, the core told, and goes in again once it is over", async () => {
    const { t, drawn, told } = setup();
    t.setDelay(500);
    t.update({ enabled: true });
    vi.advanceTimersByTime(SHOWN_AT_LEAST_MS);
    t.settled(true);
    await Promise.resolve();
    t.update({ stretched: true });
    expect(drawn).toEqual([true, false]);
    expect(told).toEqual([true, false]);
    t.update({ stretched: false });
    vi.advanceTimersByTime(500);
    expect(drawn).toEqual([true, false, true]);
  });

  it("comes out when the core refuses (floating, opened in the meantime)", async () => {
    const { t, drawn, told } = setup(false);
    t.setDelay(0);
    t.update({ enabled: true });
    vi.advanceTimersByTime(SHOWN_AT_LEAST_MS);
    t.settled(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(told).toEqual([true]);
    expect(drawn).toEqual([true, false]);
    expect(t.phase).toBe("out");
  });

  it("brought out by the cursor, it stays a moment even with no delay", async () => {
    const { t, drawn } = setup();
    t.setDelay(0);
    t.update({ enabled: true });
    vi.advanceTimersByTime(SHOWN_AT_LEAST_MS);
    t.settled(true);
    await Promise.resolve();
    t.peeked();
    expect(drawn).toEqual([true, false]);
    vi.advanceTimersByTime(SHOWN_AT_LEAST_MS - 1);
    expect(drawn).toEqual([true, false]);
    vi.advanceTimersByTime(1);
    expect(drawn).toEqual([true, false, true]);
  });

  it("turned off while in: it comes out; hidden: the core already let it out", async () => {
    const { t, drawn, told } = setup();
    t.setDelay(0);
    t.update({ enabled: true });
    vi.advanceTimersByTime(SHOWN_AT_LEAST_MS);
    t.settled(true);
    await Promise.resolve();
    t.update({ enabled: false });
    expect(told).toEqual([true, false]);
    expect(drawn).toEqual([true, false]);

    const b = setup();
    b.t.setDelay(0);
    b.t.update({ enabled: true });
    vi.advanceTimersByTime(SHOWN_AT_LEAST_MS);
    b.t.settled(true);
    await Promise.resolve();
    b.t.update({ visible: false });
    expect(b.t.phase).toBe("out");
    expect(b.told).toEqual([true]);
    // Shown again: it stays a moment before going in.
    b.t.update({ visible: true });
    vi.advanceTimersByTime(SHOWN_AT_LEAST_MS - 1);
    expect(b.drawn).toEqual([true]);
    vi.advanceTimersByTime(1);
    expect(b.drawn).toEqual([true, true]);
  });

  it("is drawn up like a drop, or fades with « reduce motion »", () => {
    const v = { presence: anim(1), fade: anim(1), squish: anim(0) };
    tuckSprings(v, true, false);
    expect([v.presence.to, v.fade.to]).toEqual([0, 1]);
    expect(v.squish.v).toBeLessThan(0);
    const calm = { presence: anim(1), fade: anim(1), squish: anim(0) };
    tuckSprings(calm, true, true);
    expect([calm.presence.to, calm.fade.to, calm.squish.v]).toEqual([1, 0, 0]);
    expect(tuckedAway(calm)).toBe(false);
    calm.fade.x = 0;
    expect(tuckedAway(calm)).toBe(true);
    tuckSprings(calm, false, true);
    expect([calm.presence.to, calm.fade.to]).toEqual([1, 1]);
  });
});
