import type { PointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { cardTilt, tiltFrame } from "./cardTilt";

describe("card tilt (step 13: once per frame)", () => {
  it("1 000 pointer moves in a frame: the box is read once and the styles written once", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    let boxes = 0;
    let writes = 0;
    const el = {
      getBoundingClientRect: () => {
        boxes++;
        return { left: 0, top: 0, width: 200, height: 300 };
      },
      style: {
        setProperty: () => writes++,
        set rotate(_v: string) {
          writes++;
        },
      },
      parentElement: null,
    } as unknown as HTMLElement;
    for (let i = 0; i < 1000; i++)
      cardTilt.onPointerMove({
        currentTarget: el,
        clientX: i % 200,
        clientY: 150,
      } as PointerEvent<HTMLElement>);
    expect(boxes).toBe(0);
    tiltFrame.flush();
    expect(boxes).toBe(1);
    expect(writes).toBe(3); // --sheen-x, --sheen-y, rotate
    tiltFrame.dispose();
    vi.unstubAllGlobals();
  });
});
