import { describe, expect, it } from "vitest";
import { gameEnd } from "./useGameReturn";

describe("gameEnd", () => {
  it("gives a game once it ran, then closed — and only once", () => {
    const e = gameEnd();
    let open = false;
    const tick = () => e.update("forza", () => open);
    tick();
    expect(e.take()).toBeNull(); // launched, not open yet
    open = true;
    tick();
    expect(e.take()).toBeNull(); // playing
    open = false;
    tick();
    expect(e.take()).toBe("forza");
    expect(e.take()).toBeNull();
  });

  it("ignores an app never seen open, and a new launch clears the old end", () => {
    const e = gameEnd();
    e.update("notFollowed", () => false);
    expect(e.take()).toBeNull();
    e.update("a", () => true);
    e.update("a", () => false);
    e.update("b", () => true); // another game started before Kayro came back
    expect(e.take()).toBeNull();
  });
});
