// Shortcut of a scene: only stored here (the global registration comes with step 12).

import type { KeyboardLayout } from "../../ipc/bindings";

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph"]);

/**
 * AZERTY keys whose letter is not the one of the US key at the same place (`code` names the US
 * key). Windows fires a shortcut on the key that types its letter, so the letter is the keycap's.
 * KeyM is « , » there: no letter.
 */
const AZERTY: Readonly<Record<string, string | null>> = {
  KeyQ: "A",
  KeyA: "Q",
  KeyW: "Z",
  KeyZ: "W",
  Semicolon: "M",
  KeyM: null,
};

const asLetter = (s: string | null | undefined) =>
  s && /^[a-z]$/i.test(s) ? s.toUpperCase() : null;

/** The letter of the US key at `code` (QWERTY). */
const usLetter = (code: string) => (/^Key[A-Z]$/.test(code) ? code.slice(3) : null);

const azertyLetter = (code: string) => (code in AZERTY ? (AZERTY[code] ?? null) : usLetter(code));

/** Without a layout map: French Windows types AZERTY (not in Canada nor Switzerland). */
function guessedLetter(code: string): string | null {
  const lang = typeof navigator === "undefined" ? "" : navigator.language.toLowerCase();
  const azerty = lang.startsWith("fr") && !/^fr-(ca|ch)/.test(lang);
  return azerty ? azertyLetter(code) : usLetter(code);
}

/** Keycap letters by `code`, read from the keyboard layout (Chromium's Keyboard Map API). */
export type LayoutMap = ReadonlyMap<string, string>;

type KeyboardApi = { getLayoutMap(): Promise<LayoutMap> };

export async function readLayoutMap(): Promise<LayoutMap | null> {
  const api = (navigator as Navigator & { keyboard?: KeyboardApi }).keyboard;
  try {
    return api ? await api.getLayoutMap() : null;
  } catch {
    return null;
  }
}

/** The key part the core accepts (letters, digits, F1–F24, Space) of a key press. */
function keyName(
  e: Pick<KeyboardEvent, "key" | "code">,
  layout: KeyboardLayout,
  map: LayoutMap | null,
): string | null {
  const { code } = e;
  // The digit row gives Windows its digits whatever the layout (on AZERTY too, unshifted « & »).
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  if (code === "Space") return "Space";
  if (layout === "qwerty") return usLetter(code);
  if (layout === "azerty") return azertyLetter(code);
  // Auto: the typed letter, else (AltGr turned it into « € ») the layout's, else a guess.
  return asLetter(e.key) ?? (map ? asLetter(map.get(code)) : guessedLetter(code));
}

export type Captured = { kind: "pending" } | { kind: "invalid" } | { kind: "ok"; hotkey: string };

/** « Ctrl+Alt+1 » from a key press: needs at least one modifier and a plain key. */
export function hotkeyFromEvent(
  e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">,
  layout: KeyboardLayout = "qwerty",
  map: LayoutMap | null = null,
): Captured {
  if (MODIFIER_KEYS.has(e.key)) return { kind: "pending" };
  const key = keyName(e, layout, map);
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
