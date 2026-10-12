import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { motionTokens } from "../../../design/motion/tokens";
import { createFrameLoop } from "../../../fx/loop";
import { CardHoverFx, cardHoverConfig } from "./cardHoverFx";
import { rimClass } from "./rimRender";

// Minimal DOM (the tests run in node): spans that keep their style, children and parent.
interface FakeEl {
  className: string;
  dataset: Record<string, string>;
  parentElement: FakeEl | null;
  children: FakeEl[];
  style: Record<string, unknown>;
  [k: string]: unknown;
}

let created: FakeEl[] = [];

function fakeEl(): FakeEl {
  const el: FakeEl = {
    className: "",
    dataset: {},
    parentElement: null,
    children: [],
    style: { setProperty: () => {} },
    setAttribute: () => {},
    append: (...kids: FakeEl[]) => {
      for (const k of kids) {
        k.parentElement = el;
        el.children.push(k);
      }
    },
    remove: () => {
      el.parentElement = null;
    },
    getAnimations: () => [],
    animate: () => ({}),
  };
  created.push(el);
  return el;
}

function card() {
  const slot = fakeEl();
  const c = { parentElement: slot, offsetWidth: 240, offsetHeight: 336, style: { rotate: "" } };
  return { slot, el: c as unknown as HTMLElement };
}

/** Fake requestAnimationFrame (as motion.test.ts): frames fired by hand. */
function fakeLoop() {
  let pending: FrameRequestCallback | null = null;
  const loop = createFrameLoop(
    (cb) => {
      pending = cb;
      return 1;
    },
    () => {
      pending = null;
    },
  );
  return {
    loop,
    /** `ms` of time, one frame every 8 ms (timers fire on the way). */
    run(ms: number) {
      for (let t = 0; t < ms; t += 8) {
        vi.advanceTimersByTime(8);
        const cb = pending;
        pending = null;
        cb?.(performance.now());
      }
    },
  };
}

const threads = () => created.filter((e) => e.className === rimClass.thread);
const lit = () => threads().some((t) => Number(t.style.opacity) > 0);
const config = cardHoverConfig(undefined, undefined, motionTokens(undefined), {
  eco: false,
  reduced: false,
  windowMode: false,
});

beforeEach(() => {
  created = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("document", { createElement: () => fakeEl() });
  vi.stubGlobal("getComputedStyle", () => ({ borderTopLeftRadius: "30px" }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("carousel card hover: life of the threads (review A3)", () => {
  it("A lit, pointer on B, out of the carousel before B lights: A fades out, the loop stops", () => {
    const { loop, run } = fakeLoop();
    const stage = { dataset: {} } as unknown as HTMLElement;
    const fx = new CardHoverFx(
      stage,
      config,
      () => false,
      () => loop,
    );
    const a = card();
    const b = card();
    fx.pointer(a.el, performance.now());
    run(500);
    expect(lit()).toBe(true);
    expect(loop.active).toBe(true);

    fx.pointer(b.el, performance.now());
    run(80);
    // A's threads fade out (168 ms) instead of being cut by B's arrival.
    expect(lit()).toBe(true);
    fx.pointer(null, performance.now());
    run(300);
    expect(lit()).toBe(false);
    // Before the fix the loop ran at 60 i/s for good here.
    expect(loop.active).toBe(false);
    // B never lit: the spans stayed on A.
    expect(created.find((e) => e.dataset.rim !== undefined)?.parentElement).toBe(a.slot);
    fx.dispose();
  });

  it("B lights once A has faded out, from level 0", () => {
    const { loop, run } = fakeLoop();
    const stage = { dataset: {} } as unknown as HTMLElement;
    const fx = new CardHoverFx(
      stage,
      config,
      () => false,
      () => loop,
    );
    const a = card();
    const b = card();
    fx.pointer(a.el, performance.now());
    run(500);
    fx.pointer(b.el, performance.now());
    run(150);
    const layer = created.find((e) => e.dataset.rim !== undefined)!;
    expect(layer.parentElement).toBe(a.slot); // still A's fade (168 ms), not B yet
    run(400);
    expect(layer.parentElement).toBe(b.slot);
    expect(lit()).toBe(true);
    fx.pointer(null, performance.now());
    run(300);
    expect(loop.active).toBe(false);
    fx.dispose();
  });

  it("a card left before its delay leaves no loop behind", () => {
    const { loop, run } = fakeLoop();
    const stage = { dataset: {} } as unknown as HTMLElement;
    const fx = new CardHoverFx(
      stage,
      config,
      () => false,
      () => loop,
    );
    fx.pointer(card().el, performance.now());
    run(60);
    fx.pointer(null, performance.now());
    run(300);
    expect(loop.active).toBe(false);
    expect(lit()).toBe(false);
    fx.dispose();
  });
});
