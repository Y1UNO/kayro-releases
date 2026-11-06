import { describe, expect, it } from "vitest";
import { hotkeyFromEvent, hotkeyTaken } from "./hotkey";

const press = (
  code: string,
  mods: Partial<Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>>,
  key = "x",
) => ({
  key,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe("hotkeyFromEvent", () => {
  it("writes modifiers then the key", () => {
    expect(hotkeyFromEvent(press("Digit1", { ctrlKey: true, altKey: true }))).toEqual({
      kind: "ok",
      hotkey: "Ctrl+Alt+1",
    });
    expect(hotkeyFromEvent(press("KeyG", { ctrlKey: true, shiftKey: true }))).toEqual({
      kind: "ok",
      hotkey: "Ctrl+Shift+G",
    });
    expect(hotkeyFromEvent(press("F5", { altKey: true }))).toEqual({
      kind: "ok",
      hotkey: "Alt+F5",
    });
  });

  it("waits while only modifiers are held, and refuses a bare or odd key", () => {
    expect(hotkeyFromEvent(press("ControlLeft", { ctrlKey: true }, "Control"))).toEqual({
      kind: "pending",
    });
    expect(hotkeyFromEvent(press("KeyA", {}))).toEqual({ kind: "invalid" });
    expect(hotkeyFromEvent(press("ArrowUp", { ctrlKey: true }))).toEqual({ kind: "invalid" });
  });
});

describe("keyboard layouts", () => {
  const ctrlAlt = { ctrlKey: true, altKey: true };
  const got = (h: ReturnType<typeof hotkeyFromEvent>) => (h.kind === "ok" ? h.hotkey : h.kind);

  it("AZERTY names the keycap: A where QWERTY has Q, M on « ; », no letter on « , »", () => {
    expect(got(hotkeyFromEvent(press("KeyQ", ctrlAlt), "azerty"))).toBe("Ctrl+Alt+A");
    expect(got(hotkeyFromEvent(press("KeyW", ctrlAlt), "azerty"))).toBe("Ctrl+Alt+Z");
    expect(got(hotkeyFromEvent(press("Semicolon", ctrlAlt), "azerty"))).toBe("Ctrl+Alt+M");
    expect(got(hotkeyFromEvent(press("KeyM", ctrlAlt), "azerty"))).toBe("invalid");
    expect(got(hotkeyFromEvent(press("KeyK", ctrlAlt), "azerty"))).toBe("Ctrl+Alt+K");
    // The digit row stays its digits (unshifted « & » on AZERTY).
    expect(got(hotkeyFromEvent(press("Digit1", ctrlAlt, "&"), "azerty"))).toBe("Ctrl+Alt+1");
  });

  it("QWERTY keeps the US key", () => {
    expect(got(hotkeyFromEvent(press("KeyQ", ctrlAlt, "a"), "qwerty"))).toBe("Ctrl+Alt+Q");
  });

  it("Auto takes the typed letter, else the layout map's (AltGr gave « € »)", () => {
    expect(got(hotkeyFromEvent(press("KeyQ", ctrlAlt, "a"), "auto"))).toBe("Ctrl+Alt+A");
    const map = new Map([["KeyE", "e"]]);
    expect(got(hotkeyFromEvent(press("KeyE", ctrlAlt, "€"), "auto", map))).toBe("Ctrl+Alt+E");
    expect(
      got(hotkeyFromEvent(press("KeyM", ctrlAlt, ","), "auto", new Map([["KeyM", ","]]))),
    ).toBe("invalid");
  });
});

describe("hotkeyTaken", () => {
  it("ignores case, spacing and order", () => {
    expect(hotkeyTaken("Ctrl+Alt+1", ["alt + ctrl + 1"])).toBe(true);
    expect(hotkeyTaken("Ctrl+Alt+1", [null, undefined, "Ctrl+Alt+2"])).toBe(false);
  });
});
