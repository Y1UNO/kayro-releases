import { describe, expect, it } from "vitest";
import { PANEL, panelSize } from "./panelSize";

describe("the opened island's size", () => {
  it("is just the search when nothing plays and nothing is typed", () => {
    expect(panelSize({ searching: false, hits: 0, music: false })).toEqual({
      width: PANEL.width,
      height: 66,
    });
  });

  it("grows with the music, then with each result", () => {
    const music = panelSize({ searching: false, hits: 0, music: true }).height;
    const one = panelSize({ searching: true, hits: 1, music: true }).height;
    const three = panelSize({ searching: true, hits: 3, music: true }).height;
    // The music, and « Mode musique » under it.
    expect(music).toBe(178);
    expect(one).toBe(106);
    expect(three).toBe(170);
    // Nothing found: one line, like one result.
    expect(panelSize({ searching: true, hits: 0, music: false }).height).toBe(one);
  });

  it("stays smaller than before (420 × 180)", () => {
    const biggest = panelSize({ searching: true, hits: 3, music: true });
    expect(biggest.width).toBeLessThan(420);
    expect(biggest.height).toBeLessThan(180);
  });
});
