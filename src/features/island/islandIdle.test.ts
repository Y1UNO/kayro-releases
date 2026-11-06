import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { islandRoom } from "./clickRegion";
import { anim, shapeOf, stepSpring, SPRINGS, atRest, type Values } from "./islandShape";
import {
  ARM_MS,
  DROWSY_AFTER_MS,
  GAP,
  Idler,
  SLEEP_AFTER_MS,
  idleSprings,
  pickGesture,
  type IdleGesture,
} from "./islandIdle";

/** An idler on fake timers; `random` 0: the shortest gaps, the first gestures in the list. */
function setup(random = () => 0) {
  const played: IdleGesture[] = [];
  const armed: boolean[] = [];
  let woke = 0;
  const i = new Idler(
    {
      play: (g) => played.push(g),
      wake: () => void woke++,
      onArmed: (a) => armed.push(a),
    },
    () => Date.now(),
    random,
  );
  return { i, played, armed, woke: () => woke };
}

const REST: Values = {
  morph: 0,
  corner: 0,
  hover: 0,
  pullX: 0,
  pullY: 0,
  vx: 0,
  vy: 0,
  squish: 0,
  presence: 1,
  open: 0,
  media: 0,
  stretch: 0,
  dots: 0,
};

describe("Kysland's idle", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("plays a first gesture once alone for a while, then one per gap", () => {
    const { i, played, armed } = setup();
    i.update({ enabled: true });
    expect(armed).toEqual([true]);
    vi.advanceTimersByTime(ARM_MS + GAP[0] - 1);
    expect(played).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(played).toHaveLength(1);
    vi.advanceTimersByTime(GAP[0]);
    expect(played).toHaveLength(2);
    // Never twice the same gesture in a row.
    expect(played[0]).not.toBe(played[1]);
  });

  it("stops at once when hovered, opened, playing music, hidden or tucked", () => {
    for (const change of [
      { hovered: true },
      { open: true },
      { busy: true },
      { visible: false },
      { tucked: true },
      { moving: true },
    ]) {
      const { i, played, armed } = setup();
      i.update({ enabled: true });
      i.update(change);
      vi.advanceTimersByTime(SLEEP_AFTER_MS);
      expect(played, JSON.stringify(change)).toEqual([]);
      expect(armed).toEqual([true, false]);
      i.dispose();
    }
  });

  it("never runs with « reduce motion » or in Éco (disabled)", () => {
    const { i, played, armed } = setup();
    i.update({ enabled: false });
    vi.advanceTimersByTime(SLEEP_AFTER_MS);
    expect(played).toEqual([]);
    expect(armed).toEqual([]);
  });

  it("grows drowsy, then sleeps until the pointer comes back with a jolt", () => {
    const { i, played, armed, woke } = setup();
    i.update({ enabled: true });
    vi.advanceTimersByTime(DROWSY_AFTER_MS);
    const awake = played.length;
    vi.advanceTimersByTime(DROWSY_AFTER_MS);
    // Drowsy: gestures 30 s apart at least instead of 8 s.
    expect(played.length - awake).toBeLessThanOrEqual(4);
    vi.advanceTimersByTime(SLEEP_AFTER_MS);
    const asleep = played.length;
    expect(armed.at(-1)).toBe(false);
    vi.advanceTimersByTime(SLEEP_AFTER_MS);
    expect(played.length).toBe(asleep);
    i.update({ hovered: true });
    expect(woke()).toBe(1);
    i.update({ hovered: false });
    expect(armed.at(-1)).toBe(true);
    vi.advanceTimersByTime(ARM_MS + GAP[0]);
    expect(played.length).toBe(asleep + 1);
  });

  it("picks the rare stretch less often, and never the last gesture", () => {
    let n = 0;
    const counts: Record<string, number> = {};
    for (let k = 0; k < 1000; k++) {
      const g = pickGesture(null, () => (n = (n + 0.6180339) % 1));
      counts[g] = (counts[g] ?? 0) + 1;
    }
    expect(counts.stretch).toBeLessThan(counts.breathe! / 2);
    for (let r = 0; r < 1; r += 0.05) expect(pickGesture("look", () => r)).not.toBe("look");
  });

  it("swells the island a few pixels and comes back to rest, inside its click region", () => {
    const v = { idle: anim(0), look: anim(0), squish: anim(0) };
    idleSprings(v, "stretch");
    let widest = 0;
    let highest = 0;
    let t = 0;
    for (; t < 4; t += 1 / 120) {
      stepSpring(v.idle, SPRINGS.idle, 1 / 120);
      stepSpring(v.look, SPRINGS.look, 1 / 120);
      const s = shapeOf({ ...REST, idle: v.idle.x, look: v.look.x });
      widest = Math.max(widest, s.width);
      highest = Math.max(highest, s.height);
      if (t > 0.2 && atRest(v.idle, SPRINGS.idle.eps)) break;
    }
    const plain = shapeOf(REST);
    expect(widest - plain.width).toBeGreaterThan(8);
    const room = islandRoom({
      media: false,
      stretch: false,
      dots: false,
      hover: false,
      breath: false,
      idle: true,
    });
    expect(widest).toBeLessThanOrEqual(room[0]);
    expect(highest).toBeLessThanOrEqual(room[1]);
    // Its loop stops within about two seconds.
    expect(t).toBeLessThan(2.2);
  });

  it("looks aside by leaning, docked and floating, and wobbles back", () => {
    const v = { idle: anim(0), look: anim(0), squish: anim(0) };
    idleSprings(v, "look", () => 0.9);
    let most = 0;
    let least = 0;
    for (let t = 0; t < 2; t += 1 / 120) {
      stepSpring(v.look, SPRINGS.look, 1 / 120);
      most = Math.max(most, v.look.x);
      least = Math.min(least, v.look.x);
    }
    expect(most).toBeGreaterThan(0.8);
    expect(least).toBeLessThan(-0.1);
    expect(Math.abs(shapeOf({ ...REST, look: 1 }).skew)).toBeCloseTo(3);
    expect(Math.abs(shapeOf({ ...REST, morph: 1, look: 1 }).rotate)).toBeCloseTo(2);
  });
});
