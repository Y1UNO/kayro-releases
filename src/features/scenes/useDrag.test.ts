import { describe, expect, it } from "vitest";
import { insertionIndex } from "./useDrag";

const rect = { left: 0, right: 300, top: 100, bottom: 400 };
const middles = [130, 200, 270, 340];

describe("insertionIndex", () => {
  it("counts the rows above the pointer", () => {
    expect(insertionIndex(rect, middles, 50, 105)).toBe(0);
    expect(insertionIndex(rect, middles, 50, 150)).toBe(1);
    expect(insertionIndex(rect, middles, 50, 280)).toBe(3);
    expect(insertionIndex(rect, middles, 50, 395)).toBe(4);
  });

  it("is null outside the list (with a small margin)", () => {
    expect(insertionIndex(rect, middles, 50, 20)).toBeNull();
    expect(insertionIndex(rect, middles, 400, 200)).toBeNull();
    expect(insertionIndex(rect, middles, -10, 210)).toBe(2);
  });

  it("an empty list accepts a drop inside it", () => {
    expect(insertionIndex(rect, [], 50, 200)).toBe(0);
  });
});
