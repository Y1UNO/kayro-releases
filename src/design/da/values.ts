import {
  CATALOGUE,
  ELEMENTS,
  type DaElement,
  type DaParam,
  type DaValue,
  type DaValues,
  type ElementValues,
} from "./catalogue";

/** Default values of one element (catalogue defaults). */
export function elementDefaults(el: DaElement): ElementValues {
  const out: Record<string, DaValue> = { on: el.defaultOn };
  for (const p of el.params) out[p.key] = p.default;
  return out as ElementValues;
}

/** Default values of the whole catalogue (= the V4 direction). */
export function defaultValues(): DaValues {
  return Object.fromEntries(CATALOGUE.map((e) => [e.id, elementDefaults(e)]));
}

/** CSS variables of every `css` element, merged. */
export function daVariables(values: DaValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of CATALOGUE) {
    const v = values[el.id];
    if (el.css && v) Object.assign(out, el.css(v));
  }
  return out;
}

/** Carousel geometry from the `cards` element (sketch values when the element is off). */
export interface CardGeometry {
  activeW: number;
  activeH: number;
  sideW: number;
  gap: number;
}
export const SKETCH_GEOMETRY: CardGeometry = { activeW: 232, activeH: 328, sideW: 172, gap: 20 };

/** `cards`: the values of the `cards` element. */
export function cardGeometry(c: ElementValues | undefined): CardGeometry {
  if (!c?.on) return SKETCH_GEOMETRY;
  return {
    activeW: c.activeW as number,
    activeH: c.activeH as number,
    sideW: c.sideW as number,
    gap: c.gap as number,
  };
}

// ---- Validation of untrusted values (presets, active.json) ----

/** Presets and active.json larger than this are refused. */
export const MAX_DA_BYTES = 64 * 1024;
const HEX = /^#[0-9a-f]{6}$/i;

function checkParam(p: DaParam, v: unknown): boolean {
  switch (p.kind) {
    case "range":
      return typeof v === "number" && Number.isFinite(v) && v >= p.min && v <= p.max;
    case "toggle":
      return typeof v === "boolean";
    case "select":
      return typeof v === "string" && p.options.includes(v);
    case "color":
      return typeof v === "string" && (v === "" || HEX.test(v));
  }
}

export type ParseResult =
  { ok: true; values: DaValues; dropped: string[] } | { ok: false; error: string };

/**
 * Strict on what it keeps: every value must have the declared type and stay within bounds.
 * Missing elements or parameters take their default (a preset saved before an element existed
 * still loads). Unknown elements or parameters (removed since) are dropped and listed.
 */
export function parseValues(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Les valeurs doivent être un objet." };
  }
  const dropped: string[] = [];
  const out: Record<string, ElementValues> = {};
  for (const id of Object.keys(raw)) if (!ELEMENTS.has(id)) dropped.push(id);
  for (const el of CATALOGUE) {
    const src = (raw as Record<string, unknown>)[el.id];
    const vals: Record<string, DaValue> = { ...elementDefaults(el) };
    if (src !== undefined) {
      if (typeof src !== "object" || src === null || Array.isArray(src)) {
        return { ok: false, error: `Élément « ${el.id} » invalide.` };
      }
      const o = src as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        if (k === "on") {
          if (typeof o.on !== "boolean") return { ok: false, error: `${el.id}.on invalide.` };
          vals.on = o.on;
          continue;
        }
        const p = el.params.find((q) => q.key === k);
        if (!p) {
          dropped.push(`${el.id}.${k}`);
          continue;
        }
        if (!checkParam(p, o[k])) return { ok: false, error: `${el.id}.${k} hors limites.` };
        vals[k] = o[k] as DaValue;
      }
    }
    out[el.id] = vals as ElementValues;
  }
  return { ok: true, values: out, dropped };
}

export interface DaPreset {
  schemaVersion: 1;
  name: string;
  savedAt: string;
  themeId: string;
  values: DaValues;
}

const PRESET_KEYS = ["schemaVersion", "name", "savedAt", "themeId", "values"];

export function parsePreset(
  raw: unknown,
): { ok: true; preset: DaPreset; dropped: string[] } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Le préréglage doit être un objet." };
  }
  const o = raw as Record<string, unknown>;
  const unknownKey = Object.keys(o).find((k) => !PRESET_KEYS.includes(k));
  if (unknownKey) return { ok: false, error: `Champ inconnu : ${unknownKey}` };
  if (o.schemaVersion !== 1) return { ok: false, error: "schemaVersion non pris en charge." };
  if (typeof o.name !== "string" || o.name.length === 0 || o.name.length > 60) {
    return { ok: false, error: "Nom invalide." };
  }
  if (typeof o.savedAt !== "string" || Number.isNaN(Date.parse(o.savedAt))) {
    return { ok: false, error: "Date invalide." };
  }
  if (typeof o.themeId !== "string" || !/^[a-z0-9-]{1,40}$/.test(o.themeId)) {
    return { ok: false, error: "Thème invalide." };
  }
  const v = parseValues(o.values);
  if (!v.ok) return v;
  return {
    ok: true,
    preset: {
      schemaVersion: 1,
      name: o.name,
      savedAt: o.savedAt,
      themeId: o.themeId,
      values: v.values,
    },
    dropped: v.dropped,
  };
}
