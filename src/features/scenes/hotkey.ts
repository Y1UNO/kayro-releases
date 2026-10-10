// Shortcut of a scene: only stored here (the global registration comes with step 12).

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph"]);

/** `KeyboardEvent.code` → the key part the core accepts (letters, digits, F1–F24, Space). */
function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  return code === "Space" ? "Space" : null;
}

export type Captured = { kind: "pending" } | { kind: "invalid" } | { kind: "ok"; hotkey: string };

/** « Ctrl+Alt+1 » from a key press: needs at least one modifier and a plain key. */
export function hotkeyFromEvent(
  e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">,
): Captured {
  if (MODIFIER_KEYS.has(e.key)) return { kind: "pending" };
  const key = keyName(e.code);
  const mods = [
    e.ctrlKey && "Ctrl",
    e.altKey && "Alt",
    e.shiftKey && "Shift",
    e.metaKey && "Super",
  ];
  const held = mods.filter(Boolean) as string[];
  if (!key || held.length === 0) return { kind: "invalid" };
  return { kind: "ok", hotkey: [...held, key].join("+") };
}

/** Same shortcut written differently (case, spaces) counts as the same. */
export const normalizeHotkey = (h: string) =>
  h
    .split("+")
    .map((p) => p.trim().toLowerCase())
    .sort()
    .join("+");

export function hotkeyTaken(
  hotkey: string,
  others: readonly (string | null | undefined)[],
): boolean {
  const wanted = normalizeHotkey(hotkey);
  return others.some((o) => o && normalizeHotkey(o) === wanted);
}
