import { describe, expect, it } from "vitest";
import { nudge, placeNear } from "./arrange";

const ORDER = ["a", "b", "c", "d", "e"];

describe("arrange (step 19b)", () => {
  it("puts an app before or after another", () => {
    expect(placeNear(ORDER, "a", "c", true)).toEqual(["b", "c", "a", "d", "e"]);
    expect(placeNear(ORDER, "e", "b", false)).toEqual(["a", "e", "b", "c", "d"]);
    expect(placeNear(ORDER, "a", "a", true)).toEqual(ORDER);
    expect(placeNear(ORDER, "a", "zz", true)).toEqual(ORDER);
  });

  it("moves one place among the visible cards of its category only", () => {
    // Visible: the cards of one category (b, d, e); a and c live elsewhere.
    expect(nudge(ORDER, ["b", "d", "e"], "d", -1)).toEqual(["a", "d", "b", "c", "e"]);
    expect(nudge(ORDER, ["b", "d", "e"], "d", 1)).toEqual(["a", "b", "c", "e", "d"]);
    expect(nudge(ORDER, ["b", "d", "e"], "b", -1)).toBeNull();
    expect(nudge(ORDER, ["b", "d", "e"], "e", 1)).toBeNull();
  });
});
