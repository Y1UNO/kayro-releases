import { describe, expect, it } from "vitest";
import type { FanCardEls } from "./fanRender";
import { LinkElements } from "./linkEls";

describe("LinkElements (step 13: the fan is put away, not unmounted)", () => {
  it("a fan put away is not there for the director, and comes back as it was", () => {
    const e = new LinkElements();
    const fan = {} as HTMLElement;
    const card = {} as FanCardEls;
    e.bind.fan(fan);
    e.bind.card(0, card);
    e.bind.parked(true);
    expect(e.get().fan).toBeNull();
    expect(e.get().cards).toEqual([]);
    expect(e.shown()).toEqual([]);
    e.bind.parked(false);
    expect(e.get().fan).toBe(fan);
    expect(e.shown()[0]).toBe(card);
  });
});
