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

describe("hotkeyTaken", () => {
  it("ignores case, spacing and order", () => {
    expect(hotkeyTaken("Ctrl+Alt+1", ["alt + ctrl + 1"])).toBe(true);
    expect(hotkeyTaken("Ctrl+Alt+1", [null, undefined, "Ctrl+Alt+2"])).toBe(false);
  });
});
