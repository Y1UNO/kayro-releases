import { parseColor } from "../lib/color";

/** A theme is pure data: no script, no path. Same shape for built-in and imported themes. */
export interface Theme {
  schemaVersion: 1;
  id: string;
  name: string;
  author: string;
  description: string;
  /** Background gradient stops, top → middle (55 %) → bottom. */
  bg: [string, string, string];
  accent: string;
  /** Soft glow behind big titles. */
  glow: string;
  /** Fog layers A / B / C (rgba with alpha). */
  fog: [string, string, string];
  /** Base colour of the cards, rgb. */
  card: [number, number, number];
  /** Colour of the light beam, rgb. */
  beam: [number, number, number];
}

const KEYS = [
  "schemaVersion",
  "id",
  "name",
  "author",
  "description",
  "bg",
  "accent",
  "glow",
  "fog",
  "card",
  "beam",
] as const;

const MAX_TEXT = 200;

function isColorList(v: unknown, n: number): v is string[] {
  return (
    Array.isArray(v) && v.length === n && v.every((c) => typeof c === "string" && parseColor(c))
  );
}

function isRgb(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255)
  );
}

/** Strict validation of an untrusted object (unknown keys rejected). Returns the theme or an error message. */
export function parseTheme(
  raw: unknown,
): { ok: true; theme: Theme } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Le thème doit être un objet." };
  }
  const o = raw as Record<string, unknown>;
  const unknownKey = Object.keys(o).find((k) => !(KEYS as readonly string[]).includes(k));
  if (unknownKey) return { ok: false, error: `Champ inconnu : ${unknownKey}` };
  if (o.schemaVersion !== 1) return { ok: false, error: "schemaVersion non pris en charge." };
  for (const k of ["id", "name", "author", "description"] as const) {
    const v = o[k];
    if (typeof v !== "string" || v.length === 0 || v.length > MAX_TEXT) {
      return { ok: false, error: `Champ « ${k} » invalide.` };
    }
  }
  if (!/^[a-z0-9-]{1,40}$/.test(o.id as string))
    return { ok: false, error: "Identifiant invalide." };
  if (!isColorList(o.bg, 3)) return { ok: false, error: "Champ « bg » invalide." };
  if (!isColorList(o.fog, 3)) return { ok: false, error: "Champ « fog » invalide." };
  if (typeof o.accent !== "string" || !parseColor(o.accent)) {
    return { ok: false, error: "Champ « accent » invalide." };
  }
  if (typeof o.glow !== "string" || !parseColor(o.glow)) {
    return { ok: false, error: "Champ « glow » invalide." };
  }
  if (!isRgb(o.card)) return { ok: false, error: "Champ « card » invalide." };
  if (!isRgb(o.beam)) return { ok: false, error: "Champ « beam » invalide." };
  return { ok: true, theme: o as unknown as Theme };
}
