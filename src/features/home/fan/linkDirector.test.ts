import { beforeAll, describe, expect, it } from "vitest";
import { stageCue } from "../../../fx/gpu/cues";
import { linkConfig } from "./fanTimeline";
import { LinkDirector } from "./linkDirector";

// Minimal DOM: a carousel stage with three slots (the tests run in node).
const style = () => {
  const s: Record<string, unknown> = {
    transform: "",
    opacity: "",
    zIndex: "",
    willChange: "",
    getPropertyValue: (k: string) => (s[k] as string) ?? "",
  };
  return s;
};

function fakeCarousel() {
  const slots = [-1, 0, 1].map((d) => {
    const card = { style: style(), dataset: { stage: "" }, querySelectorAll: () => [] };
    const s = style();
    s["--x"] = `${d * 230}px`;
    return {
      dataset: { d: String(d) },
      style: s,
      offsetWidth: 232,
      offsetHeight: 328,
      querySelector: () => card,
      card,
    };
  });
  const stage = {
    style: { ...style(), getPropertyValue: () => "0.74" },
    dataset: {} as Record<string, string>,
    querySelectorAll: () => slots,
    getBoundingClientRect: () => ({ left: 0, top: 100, width: 1700, height: 340 }),
  };
  const area = {
    querySelector: (sel: string) => (sel === "[data-carousel-stage]" ? stage : null),
  };
  return { area: area as unknown as HTMLElement, slots };
}

beforeAll(() => {
  Object.assign(globalThis, {
    getComputedStyle: () => ({ borderTopLeftRadius: "28px" }),
  });
});

describe("category director: the carousel at rest is measured again by the engine", () => {
  it("no pose is left behind when the carousel is handed back to its CSS (jump)", () => {
    const d = new LinkDirector(linkConfig(undefined));
    const { area, slots } = fakeCarousel();
    d.bind.area(area);
    d.rest("spread", 0, 0);
    // Stale poses here drew the glass where the cards were at the end of the sequence (bug).
    expect(stageCue()).toBeNull();
    expect(slots.every((s) => s.style.transform === "")).toBe(true);
    d.dispose();
  });

  it("no pose is left behind after a tab sequence (reduced motion: ends at once)", async () => {
    const d = new LinkDirector(linkConfig(undefined));
    const { area } = fakeCarousel();
    d.bind.area(area);
    d.rest("spread", 0, 0);
    const done = await d.play("tab", 1, 1, { eco: false, reduced: true });
    expect(done).toBe(true);
    expect(stageCue()).toBeNull();
    d.dispose();
  });
});
