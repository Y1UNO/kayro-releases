import { describe, expect, it } from "vitest";
import { glassFloatOf } from "../../../design/glass/glassRegistry";
import type { FrameLoop, Tick } from "../../../fx/loop";
import { CarouselFloat } from "./carouselFloat";

function fakeLoop() {
  const ticks = new Set<Tick>();
  const loop: FrameLoop = {
    subscribe(tick) {
      ticks.add(tick);
      return () => void ticks.delete(tick);
    },
    pause() {},
    resume() {},
    get active() {
      return ticks.size > 0;
    },
  };
  return { loop, ticks };
}

function fakeStage(ids: string[]) {
  const boxes = ids.map((id) => {
    const card = { id } as unknown as HTMLElement;
    const slot = { dataset: { appId: id } as Record<string, string> } as unknown as HTMLElement;
    const el = {
      style: { transform: "" },
      parentElement: slot,
      querySelector: () => card,
    } as unknown as HTMLElement;
    return { el, slot, card };
  });
  const stage = {
    dataset: {} as Record<string, string>,
    querySelectorAll: () => boxes.map((b) => b.el),
  } as unknown as HTMLElement;
  return { stage, boxes };
}

const CONFIG = { amp: 5, tilt: 0.8, period: 4400, fps: 60, idleFps: 30 };

describe("carousel floating (round 5)", () => {
  it("floats every visible card on its own rhythm, and tells the glass engine", () => {
    const { loop, ticks } = fakeLoop();
    const { stage, boxes } = fakeStage(["steam", "discord"]);
    const f = new CarouselFloat(stage, CONFIG, () => loop);
    f.refresh();
    expect(ticks.size).toBe(1);
    for (let t = 0; t <= 2000; t += 16) f.tick(16, t);
    const [a, b] = boxes;
    expect(a!.el.style.transform).toMatch(/^translateY\(-?\d/);
    expect(a!.el.style.transform).not.toBe(b!.el.style.transform);
    expect(glassFloatOf(a!.card)).toBeDefined();
    f.dispose();
    expect(ticks.size).toBe(0);
    expect(a!.el.style.transform).toBe("");
    expect(glassFloatOf(a!.card)).toBeUndefined();
  });

  it("comes back to floating slowly after a pause (no jolt), rests fast", () => {
    const { loop } = fakeLoop();
    const { stage, boxes } = fakeStage(["steam"]);
    const f = new CarouselFloat(stage, CONFIG, () => loop);
    f.refresh();
    const dy = () =>
      Math.abs(Number(/translateY\((-?[\d.]+)px/.exec(boxes[0]!.el.style.transform)?.[1] ?? 0));
    let max200 = 0;
    for (let t = 0; t <= 200; t += 16) {
      f.tick(16, t);
      max200 = Math.max(max200, dy());
    }
    expect(max200).toBeLessThan(CONFIG.amp * 0.45); // well under half the amplitude at 200 ms
  });

  it("eases the hovered card to rest, and every card at once for a sequence", () => {
    const { loop } = fakeLoop();
    const { stage, boxes } = fakeStage(["steam", "discord"]);
    const f = new CarouselFloat(stage, CONFIG, () => loop);
    f.refresh();
    for (let t = 0; t <= 1000; t += 16) f.tick(16, t);
    f.hover(boxes[0]!.card);
    for (let t = 1016; t <= 2500; t += 16) f.tick(16, t);
    expect(boxes[0]!.el.style.transform).toBe("");
    expect(boxes[1]!.el.style.transform).not.toBe("");
    stage.dataset.seq = "";
    f.tick(16, 2516);
    expect(boxes[1]!.el.style.transform).toBe("");
  });

  it("only floating: 30 i/s; a hover or a wheel brings the full cadence back at once", () => {
    const { loop, ticks } = fakeLoop();
    const { stage, boxes } = fakeStage(["steam", "discord"]);
    const f = new CarouselFloat(stage, CONFIG, () => loop);
    f.refresh();
    expect(f.fps).toBe(60); // the cards ease in first (slowly: no jolt)
    for (let t = 0; t <= 1000; t += 16) f.tick(16, t);
    expect(f.fps).toBe(60);
    for (let t = 1016; t <= 2600; t += 16) f.tick(16, t);
    expect(f.fps).toBe(30);
    expect(ticks.size).toBe(1);
    f.hover(boxes[0]!.card);
    expect(f.fps).toBe(60);
    f.hover(null);
    for (let t = 2616; t <= 5000; t += 16) f.tick(16, t);
    expect(f.fps).toBe(30);
    f.wheel(5000);
    expect(f.fps).toBe(60);
    expect(ticks.size).toBe(1);
  });

  it("no floating, no loop at « Aucune »", () => {
    const { loop, ticks } = fakeLoop();
    const { stage } = fakeStage(["steam"]);
    const f = new CarouselFloat(stage, { ...CONFIG, amp: 0 }, () => loop);
    f.refresh();
    expect(ticks.size).toBe(0);
    f.setConfig(CONFIG);
    expect(ticks.size).toBe(1);
    f.setConfig({ ...CONFIG, amp: 0 });
    expect(ticks.size).toBe(0);
  });
});
