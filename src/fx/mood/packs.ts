import type { Mood } from "./types";

/**
 * The built-in ambiences (step 16): Braises, Étoiles, Brume, Runes, Pluie, and « Aucune » (no id:
 * the theme's atmosphere alone). Original shapes only, never a game's art (ARCHITECTURE.md § 7).
 * Glyphs: SVG path data in a 0–100 box, drawn in strokes (glyphAtlas.ts). Their displayed names
 * come from the catalogue (`moods.packs.<id>`), the `name` here is the one an export carries.
 */
const RUNE_STAVE = "M50 8 L50 92 M50 30 L76 14 M50 52 L24 36 M50 70 L76 86";
const RUNE_KEY = "M32 10 L32 90 M32 12 L68 32 L32 52 M32 52 L70 90";
const RUNE_ARCH = "M20 82 L50 14 L80 82 M34 56 L66 56";

export const MOOD_PACKS: readonly Mood[] = [
  {
    schemaVersion: 1,
    id: "braises",
    name: "Braises",
    glyphs: {},
    layers: [
      {
        type: "particles",
        shape: "ember",
        count: 34,
        size: [1.6, 3.4],
        speed: [30, 70],
        direction: "up",
        drift: 0.4,
        life: [5, 10],
        colorRole: "accent",
        opacity: 0.85,
      },
      { type: "pulse", period: 7, colorRole: "accent", opacity: 0.22 },
    ],
  },
  {
    schemaVersion: 1,
    id: "etoiles",
    name: "Étoiles",
    glyphs: {},
    layers: [
      {
        type: "particles",
        shape: "star",
        count: 46,
        size: [0.8, 2.2],
        speed: [0, 3],
        direction: "up",
        drift: 0.05,
        life: [3, 8],
        colorRole: "text",
        opacity: 0.8,
      },
      {
        type: "particles",
        shape: "dot",
        count: 10,
        size: [1.5, 3],
        speed: [4, 10],
        direction: "up",
        drift: 0.5,
        life: [10, 18],
        colorRole: "dominant",
        opacity: 0.4,
      },
    ],
  },
  {
    schemaVersion: 1,
    id: "brume",
    name: "Brume",
    glyphs: {},
    layers: [
      { type: "mist", count: 5, colorRole: "dominant", opacity: 0.4, speed: 10 },
      { type: "mist", count: 3, colorRole: "accent", opacity: 0.28, speed: 6 },
      {
        type: "particles",
        shape: "dot",
        count: 14,
        size: [1.5, 3.5],
        speed: [6, 14],
        direction: "up",
        drift: 0.6,
        life: [8, 16],
        colorRole: "text",
        opacity: 0.5,
      },
    ],
  },
  {
    schemaVersion: 1,
    id: "runes",
    name: "Runes",
    glyphs: { stave: RUNE_STAVE, key: RUNE_KEY, arch: RUNE_ARCH },
    layers: [
      {
        type: "glyphRing",
        glyph: "stave",
        count: 12,
        radius: 0.4,
        rotation: 5,
        size: 30,
        colorRole: "accent",
        opacity: 0.75,
      },
      {
        type: "particles",
        shape: "glyph",
        glyph: "key",
        count: 10,
        size: [18, 28],
        speed: [8, 18],
        direction: "up",
        drift: 0.3,
        life: [8, 14],
        colorRole: "dominant",
        opacity: 0.5,
      },
      {
        type: "particles",
        shape: "glyph",
        glyph: "arch",
        count: 8,
        size: [16, 24],
        speed: [6, 14],
        direction: "up",
        drift: 0.3,
        life: [9, 15],
        colorRole: "accent",
        opacity: 0.3,
      },
      { type: "pulse", period: 6, colorRole: "accent", opacity: 0.3 },
    ],
  },
  {
    schemaVersion: 1,
    id: "pluie",
    name: "Pluie",
    glyphs: {},
    layers: [
      {
        type: "particles",
        shape: "line",
        count: 70,
        size: [22, 40],
        speed: [320, 400],
        direction: "down",
        drift: 0.05,
        life: [1.5, 2.5],
        colorRole: "text",
        opacity: 0.5,
      },
      { type: "mist", count: 3, colorRole: "dominant", opacity: 0.25, speed: 4 },
    ],
  },
];

/** Built-in ids, in the order of the « Ambiance du jeu » choices (none first). */
export const PACK_IDS = ["aucune", "braises", "etoiles", "brume", "runes", "pluie"] as const;
