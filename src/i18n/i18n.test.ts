import { describe, expect, it } from "vitest";
import { APP_NAME } from "../app/appName";
import { MESSAGE_KEYS, t } from "./index";
import fr from "./fr.json";
import { ERROR_MESSAGE_KEYS } from "../ipc/errors";

describe("t()", () => {
  it("returns the message and fills placeholders", () => {
    expect(t("app.appsCount", { count: 3 })).toBe("Applications : 3");
  });

  it("leaves unknown placeholders visible instead of failing", () => {
    expect(t("app.appsCount")).toBe("Applications : {count}");
    expect(t("app.appsCount", { other: 1 })).toBe("Applications : {count}");
  });

  it("rejects unknown keys at compile time", () => {
    // @ts-expect-error — not in the catalogue
    expect(t("nope.missing")).toBe("nope.missing");
  });
});

describe("catalogue", () => {
  it("has no empty message", () => {
    expect(MESSAGE_KEYS.length).toBeGreaterThan(0);
    for (const key of MESSAGE_KEYS) expect(t(key as Parameters<typeof t>[0]).trim()).not.toBe("");
  });

  it("has a message for every error code and no unused error message", () => {
    const used = Object.values(ERROR_MESSAGE_KEYS).map((k) => k.replace("errors.", ""));
    expect(Object.keys(fr.errors).sort()).toEqual([...used].sort());
  });
});

describe("{app} placeholder", () => {
  it("is always the display name", () => {
    expect(t("home.menu.remove")).toBe(`Retirer de ${APP_NAME}…`);
    expect(APP_NAME).toBe("Kayro");
  });
});
