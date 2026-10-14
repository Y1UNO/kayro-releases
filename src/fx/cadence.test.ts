import { afterEach, describe, expect, it } from "vitest";
import { CADENCE, cadenceFor, ECO_MAX_FPS, FX_MAX_FPS, underDialog } from "./budget";
import { dialogOpen, holdDialogCap, liveCadence, resetDialogCap } from "./cadenceCap";
import { engineFps, Pacer, shouldDraw, type Triggers } from "./gpu/cadence";
import { createFrameLoop } from "./loop";
import { PointerFrame } from "./pointerFrame";

const none: Triggers = { moved: false, cued: false, dirty: false, ambient: false, pointer: false };

/** Frames of a 278 Hz screen over `ms`, and how many of them draw for these triggers. */
function drawsPerSecond(t: Triggers, fps: { ambient: number; pointer: number }, ms = 1000): number {
  const c = { ...cadenceFor("high"), ...fps };
  const last = { ambient: -1, pointer: -1 };
  let n = 0;
  for (let now = 0; now < ms; now += 1000 / 278) if (shouldDraw(t, now, c, last)) n++;
  return (n * 1000) / ms;
}

afterEach(() => resetDialogCap());

describe("cadence tokens (step 13)", () => {
  it("High and Balanced are capped, Ultra keeps the display rate, Eco stays at 30", () => {
    expect(CADENCE).toEqual({
      pointerOnly: 60,
      underDialog: 30,
      restHigh: 30,
      sequence: 60,
      glassFollow: 60,
    });
    for (const q of ["high", "balanced"] as const)
      expect(cadenceFor(q)).toEqual({ ambient: 30, pointer: 60, sequence: 60, glass: 60 });
    expect(cadenceFor("ultra")).toEqual({
      ambient: 60,
      pointer: FX_MAX_FPS,
      sequence: FX_MAX_FPS,
      glass: FX_MAX_FPS,
    });
    expect(Object.values(cadenceFor("eco"))).toEqual([
      ECO_MAX_FPS,
      ECO_MAX_FPS,
      ECO_MAX_FPS,
      ECO_MAX_FPS,
    ]);
  });

  it("a dialog holds every rate at 30, Ultra included", () => {
    expect(underDialog(cadenceFor("ultra"))).toEqual({
      ambient: 30,
      pointer: 30,
      sequence: 30,
      glass: 30,
    });
  });
});

describe("when the glass engine draws", () => {
  it("the ambience alone draws on its grid, the pointer alone on its own", () => {
    expect(drawsPerSecond({ ...none, ambient: true }, { ambient: 30, pointer: 60 })).toBeCloseTo(
      30,
      -1,
    );
    expect(drawsPerSecond({ ...none, pointer: true }, { ambient: 30, pointer: 60 })).toBeCloseTo(
      60,
      -1,
    );
    expect(drawsPerSecond(none, { ambient: 30, pointer: 60 })).toBe(0);
  });

  it("a glass moved in the DOM, a cue or a forced redraw draws at once", () => {
    for (const t of ["moved", "cued", "dirty"] as const)
      expect(drawsPerSecond({ ...none, [t]: true }, { ambient: 30, pointer: 60 })).toBeGreaterThan(
        270,
      );
  });

  it("a stage sequence retunes the subscription to its rate, back to the glass rate after", () => {
    expect(engineFps(cadenceFor("high"), false)).toBe(60);
    const c = { ...cadenceFor("high"), glass: FX_MAX_FPS }; // glassFollow raised back
    expect(engineFps(c, true)).toBe(60);
    expect(engineFps(c, false)).toBe(FX_MAX_FPS);
    const set: number[] = [];
    const sub = Object.assign(() => {}, { setFps: (f: number) => set.push(f) });
    const p = new Pacer();
    p.fps = FX_MAX_FPS;
    p.frame(none, 0, c, true, sub);
    p.frame(none, 10, c, true, sub);
    p.frame(none, 20, c, false, sub);
    expect(set).toEqual([60, FX_MAX_FPS]);
  });
});

describe("dialog cap", () => {
  it("counts the dialogs, and a release twice changes nothing", () => {
    const a = holdDialogCap();
    const b = holdDialogCap();
    a();
    a();
    expect(dialogOpen()).toBe(true);
    b();
    expect(dialogOpen()).toBe(false);
  });

  it("caps the live cadence while held", () => {
    expect(liveCadence().pointer).toBe(60);
    const off = holdDialogCap();
    expect(liveCadence()).toEqual({ ambient: 30, pointer: 30, sequence: 30, glass: 30 });
    off();
  });
});

describe("pointer work once per frame", () => {
  it("1 000 moves in one frame: one piece of work, at the last position", () => {
    const work: [string, number, number][] = [];
    const loop = createFrameLoop(
      () => 1,
      () => {},
    );
    const f = new PointerFrame<string>(
      (k, _el, x, y) => work.push([k, x, y]),
      () => loop,
      () => 60,
    );
    const el = {} as HTMLElement;
    for (let i = 0; i < 1000; i++) f.push("card", el, i, 2 * i);
    f.flush();
    expect(work).toEqual([["card", 999, 1998]]);
    f.flush();
    expect(work).toHaveLength(1);
  });

  it("a cancelled position is never applied (the pointer left)", () => {
    const work: string[] = [];
    const loop = createFrameLoop(
      () => 1,
      () => {},
    );
    const f = new PointerFrame<string>(
      (k) => work.push(k),
      () => loop,
      () => 60,
    );
    f.push("a", {} as HTMLElement, 1, 1);
    f.push("b", {} as HTMLElement, 1, 1);
    f.cancel("a");
    f.flush();
    expect(work).toEqual(["b"]);
  });

  it("lets the loop go after a while without moves", () => {
    const loop = createFrameLoop(
      () => 1,
      () => {},
    );
    const f = new PointerFrame<string>(
      () => {},
      () => loop,
      () => 60,
    );
    f.push("a", {} as HTMLElement, 0, 0);
    expect(loop.active).toBe(true);
    for (let i = 0; i < 40; i++) f.flush();
    expect(loop.active).toBe(false);
  });
});

describe("frame loop setFps", () => {
  it("changes the cap in place, without skipping the next frame", () => {
    let cb: FrameRequestCallback | null = null;
    const loop = createFrameLoop(
      (c) => {
        cb = c;
        return 1;
      },
      () => {},
    );
    const ticks: number[] = [];
    const off = loop.subscribe((_dt, now) => ticks.push(now), 30);
    const fire = (now: number) => (cb as FrameRequestCallback | null)?.(now);
    fire(0); // first frame: takes the time only
    fire(10); // same 30 Hz slot: no tick
    off.setFps?.(144);
    fire(14); // ticks at once on the new grid
    fire(16); // same 144 slot (14 → 16): no tick
    fire(21);
    expect(ticks).toEqual([14, 21]);
  });
});
