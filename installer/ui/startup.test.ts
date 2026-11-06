import { describe, expect, it } from "vitest";
import type { StartupEntry } from "./backend";
import { changeable, someNames, startupChoice } from "./startup";

const app = (id: string, enabled = true, locked: StartupEntry["locked"] = null): StartupEntry => ({
  id,
  name: id.split(":").pop() ?? id,
  target: "",
  scope: locked === "machine" ? "machine" : "user",
  enabled,
  locked,
  byKayro: false,
});

const PC = [
  app("user:run:Discord"),
  app("user:run:Steam"),
  app("user:run:OneDrive", false),
  app("user:run:Kayro", true, "kayro"),
  app("machine:run:RtkAudUService", true, "machine"),
];

describe("« Au démarrage du PC » (step 19)", () => {
  it("only offers the user's apps that start today", () => {
    expect(changeable(PC).map((e) => e.id)).toEqual(["user:run:Discord", "user:run:Steam"]);
  });

  it("keeps only Kayro by default, with Kayro on its home screen", () => {
    expect(startupChoice(PC)).toEqual({ kayro: true, keep: [] });
  });

  it("changes nothing when no app could be switched off", () => {
    expect(startupChoice([app("user:run:Kayro", true, "kayro")])).toEqual({
      kayro: true,
      keep: null,
    });
  });

  it("names three apps, then counts the others", () => {
    expect(someNames(changeable(PC))).toBe("Discord, Steam");
    const many = ["a", "b", "c", "d", "e"].map((n) => app(`user:run:${n}`));
    expect(someNames(many)).toBe("a, b, c et 2 autres");
  });
});
