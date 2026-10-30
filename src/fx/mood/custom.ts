import type { Mood } from "./types";

/**
 * Made-to-measure ambiences (step 17), one per « pépite » game, written by hand from a brief.
 * Original shapes only (no game art, no logo): the game is only named in `gameHint`.
 *
 * « Sceau de la sorcière » (Hades II, brief of reference/ambiances/hades-II): a slow ring of
 * witch's sigils around the shown card, embers rising like from a brazier, a low green-tinted
 * mist, a moon crescent now and then, and the card breathing in a pulse of light.
 */
const CRESCENT = "M62 12 A40 40 0 1 0 62 88 A32 32 0 1 1 62 12 Z";
const SIGIL_EYE = "M10 50 Q50 14 90 50 Q50 86 10 50 Z M50 38 L50 62 M38 50 L62 50";
const SIGIL_FORK = "M50 90 L50 30 M50 30 L28 10 M50 30 L72 10 M34 60 L66 60";

/**
 * « Pétales du Gommage » (Clair Obscur: Expedition 33 brief: a painted Belle Époque world, people
 * erased in swirls of red petals): petals and golden dust drifting on the wind, a low haze, a
 * column of light; launched through the « Gommage » sequence.
 */
const PETAL =
  "M50 6 C72 22 80 52 66 78 C60 88 54 94 50 94 C46 94 40 88 34 78 C20 52 28 22 50 6 Z M50 30 L50 84";

export const CUSTOM_MOODS: readonly Mood[] = [
  {
    schemaVersion: 1,
    id: "sceau-sorciere",
    name: "Sceau de la sorcière",
    gameHint: "Hades II",
    glyphs: { crescent: CRESCENT, eye: SIGIL_EYE, fork: SIGIL_FORK },
    launch: "seal",
    layers: [
      {
        type: "glyphRing",
        glyph: "eye",
        count: 9,
        radius: 0.36,
        rotation: -4,
        size: 30,
        colorRole: "dominant",
        opacity: 0.7,
      },
      {
        type: "glyphRing",
        glyph: "fork",
        count: 7,
        radius: 0.46,
        rotation: 3,
        size: 24,
        colorRole: "accent",
        opacity: 0.45,
      },
      {
        type: "particles",
        shape: "ember",
        count: 30,
        size: [1.4, 3.2],
        speed: [35, 80],
        direction: "up",
        drift: 0.45,
        life: [4, 9],
        colorRole: "dominant",
        opacity: 0.9,
      },
      {
        type: "particles",
        shape: "glyph",
        glyph: "crescent",
        count: 5,
        size: [16, 26],
        speed: [6, 12],
        direction: "up",
        drift: 0.25,
        life: [10, 16],
        colorRole: "accent",
        opacity: 0.4,
      },
      { type: "mist", count: 4, colorRole: "dominant", opacity: 0.3, speed: 7 },
      { type: "pulse", period: 5, colorRole: "dominant", opacity: 0.4 },
    ],
  },
  {
    schemaVersion: 1,
    id: "petales-gommage",
    name: "Pétales du Gommage",
    gameHint: "Clair Obscur: Expedition 33",
    glyphs: { petal: PETAL },
    launch: "gommage",
    layers: [
      {
        type: "particles",
        shape: "glyph",
        glyph: "petal",
        count: 22,
        size: [14, 24],
        speed: [30, 70],
        direction: "right",
        drift: 0.6,
        life: [6, 11],
        colorRole: "accent",
        opacity: 0.7,
      },
      {
        type: "particles",
        shape: "dot",
        count: 26,
        size: [1, 2.2],
        speed: [4, 10],
        direction: "up",
        drift: 0.5,
        life: [6, 12],
        colorRole: "dominant",
        opacity: 0.5,
      },
      { type: "mist", count: 3, colorRole: "dominant", opacity: 0.18, speed: 5 },
      { type: "beam", count: 1, sway: 2, colorRole: "text", opacity: 0.25 },
    ],
  },
];
