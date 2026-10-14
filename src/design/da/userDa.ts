/**
 * Round 5: the « Visuel » settings choose variants of the art direction. The exported direction
 * (active.json) stays the base; these overrides are merged on top of it in every window, so the
 * CSS variables, the glass engine and the hooks follow without knowing about the settings.
 * A setting can switch an element off, never on: what the direction turned off stays off.
 */
import type { Settings } from "../../ipc/bindings";
import type { DaValue, DaValues, ElementValues } from "./daParams";

type Overrides = Readonly<Record<string, Readonly<Record<string, DaValue>>>>;

const SPRING = { soft: "douce", normal: "normale", strong: "forte" } as const;

/** What the settings change in the art direction (element id → values). */
export function userOverrides(s: Settings): Overrides {
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
    categoryHover: { float: s.cardFloat },
    cardHover: { style: s.cardHover },
    bokeh: { on: s.bokeh },
    embers: { on: s.particles },
    stars: { on: s.particles },
    cursorLight: { on: s.cursorLight },
  };
}

/** The direction with the user's choices merged in (`settings` null: the direction as is). */
export function withUser(base: DaValues, settings: Settings | null | undefined): DaValues {
  if (!settings) return base;
  const out: Record<string, ElementValues> = { ...base };
  for (const [id, change] of Object.entries(userOverrides(settings))) {
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
export function sameUserChoices(a: Settings | null | undefined, b: Settings | null | undefined) {
  if (!a || !b) return a === b;
  const x = userOverrides(a);
  const y = userOverrides(b);
  return Object.keys(x).every((id) => Object.entries(x[id]!).every(([k, v]) => y[id]?.[k] === v));
}
