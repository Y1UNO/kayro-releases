/**
 * Round 5: the « Visuel » settings choose variants of the art direction. The exported direction
 * (active.json) stays the base; these overrides are merged on top of it in every window, so the
 * CSS variables, the glass engine and the hooks follow without knowing about the settings.
 * A setting can switch an element off, never on: what the direction turned off stays off.
 */
import type { AutoRung } from "../../fx/autoQuality";
import type { Settings } from "../../ipc/bindings";
import type { DaValue, DaValues, ElementValues } from "./daParams";

type Overrides = Readonly<Record<string, Readonly<Record<string, DaValue>>>>;

const SPRING = { soft: "douce", normal: "normale", strong: "forte" } as const;

/**
 * « Auto » (step 24) lightens two costly effects before lowering the whole level: from its
 * « hover » rung the cards' hover is simple, from « float » their float is light. Never heavier
 * than the user's own choice.
 */
function autoCaps(s: Settings, rung: AutoRung): Pick<Settings, "cardHover" | "cardFloat"> {
  const r = s.quality === "auto" ? rung : "high";
  const hoverCap = r !== "high";
  const floatCap = r === "float" || r === "balanced" || r === "eco";
  return {
    cardHover: hoverCap && s.cardHover === "full" ? "simple" : s.cardHover,
    cardFloat:
      floatCap && (s.cardFloat === "visible" || s.cardFloat === "strong") ? "light" : s.cardFloat,
  };
}

/** What the settings change in the art direction (element id → values). */
export function userOverrides(s: Settings, rung: AutoRung = "high"): Overrides {
  const { cardHover, cardFloat } = autoCaps(s, rung);
  return {
    opening: {
      on: s.openingStyle !== "none",
      pulse: s.openingStyle === "classic" ? "v1a" : "c",
    },
    motion: {
      style: s.motionStyle,
      widgetMotion: s.widgetUnroll === "sober" ? "sobre" : "deroule",
      widgetSpring: SPRING[s.widgetSpring],
    },
    categoryHover: { float: cardFloat },
    cardHover: { style: cardHover },
    bokeh: { on: s.bokeh },
    embers: { on: s.particles },
    stars: { on: s.particles },
    cursorLight: { on: s.cursorLight },
  };
}

/** The direction with the user's choices merged in (`settings` null: the direction as is). */
export function withUser(
  base: DaValues,
  settings: Settings | null | undefined,
  rung: AutoRung = "high",
): DaValues {
  if (!settings) return base;
  const out: Record<string, ElementValues> = { ...base };
  for (const [id, change] of Object.entries(userOverrides(settings, rung))) {
    const cur = base[id];
    if (!cur) continue;
    const next: Record<string, DaValue> = { ...cur, ...change };
    // Never switch on what the direction switched off.
    next.on = cur.on && change.on !== false;
    out[id] = next as ElementValues;
  }
  return out;
}

/** Same values for what the settings drive (no re-render of the whole direction for nothing). */
export function sameUserChoices(
  a: Settings | null | undefined,
  b: Settings | null | undefined,
  ra: AutoRung = "high",
  rb: AutoRung = "high",
) {
  if (!a || !b) return a === b;
  const x = userOverrides(a, ra);
  const y = userOverrides(b, rb);
  return Object.keys(x).every((id) => Object.entries(x[id]!).every(([k, v]) => y[id]?.[k] === v));
}
