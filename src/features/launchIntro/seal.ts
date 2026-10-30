/**
 * Launch sequence « Sceau » (30/10, 2nd version: ambience « Sceau de la sorcière », Hades II brief;
 * references: a swirl of green ink, cel-shaded green flames under a glowing circle of runes). The
 * game is started at once, behind the hub (launch cover, desktop/cover.rs); meanwhile a small 3D
 * scene plays: the card is isolated in a night of moving ink, a circle of runes is drawn on the
 * ground under it, a seal rises behind it, green flames catch all round, and once the game's
 * window is up (or at the ceiling) the card burns into the fire, a pillar of light, a flash.
 * Original shapes only. Times in ms; lengths in CSS px of the card's plane (world units).
 */
export const SEAL = {
  /** The hub fades into the scene. */
  inMs: 700,
  /** Ground circle: traced, then its runes burn in. */
  ground: { from: 700, to: 2200, runesFrom: 1300, runesTo: 2700 },
  /** The upright seal behind the card. */
  seal: { showFrom: 1600, showTo: 1900, from: 1700, to: 3000, runesFrom: 2300, runesTo: 3600 },
  star: { from: 2600, to: 3300 },
  /** Flames catch one after the other round the circle, each over `growMs`. */
  flames: { count: 16, from: 3000, stagger: 45, growMs: 480 },
  /** The finale's timing (minimum, ceiling, grace) is shared by every scene: cinema/scene.ts. */
  /** Finale: surge, burn, collapse, pillar, flash, black (ms from its start). */
  finale: {
    ms: 1400,
    surge: [0, 600],
    burn: [300, 1100],
    collapse: [600, 1200],
    pillar: [500, 1000],
    flash: [900, 1250],
    black: [1200, 1400],
  },
  /** Card: pushed back and lifted, slight turn, bob (world px, degrees). */
  card: { back: 110, lift: -18, yaw: -5, bob: 4, moveFrom: 200, moveTo: 1600 },
  /** Focal length × the window's height (the perspective of the little scene). */
  focal: 1.6,
  /** Ground circle: its plane under the card (× card height), its radius (× card height). */
  groundY: 0.62,
  radius: 1.15,
  /** Upright seal: behind the flames (× radius, + px), its radius (× card height). */
  sealZ: [0.9, 80],
  sealR: 0.95,
  /** Flames: height (× card height) and width (× flame height). */
  flameH: [0.4, 0.56],
  flameW: 0.62,
  embers: 70,
  /** Backing resolution of the scene × device pixels (Eco: lower). */
  res: { high: 0.8, eco: 0.5 },
  /** The game's name under the circle, from the hold. */
  caption: { from: 3600, to: 4400 },
} as const;

/**
 * The runes (SVG path data in a 0–100 box, strokes), original witch's marks: eye, fork, crescent
 * and star, hourglass, key, triad, spiral, cross under a moon.
 */
export const RUNES: readonly string[] = [
  "M10 50 Q50 18 90 50 Q50 82 10 50 Z M50 38 L50 62",
  "M50 92 L50 34 M50 34 L26 10 M50 34 L74 10 M32 64 L68 64",
  "M62 14 A36 36 0 1 0 62 86 A28 28 0 1 1 62 14 Z M80 46 L83 52 L90 54 L83 57 L80 64 L77 57 L70 54 L77 52 Z",
  "M24 12 L76 12 L24 88 L76 88 Z",
  "M50 10 L50 90 M50 22 L70 32 L50 42 M50 62 L30 72 L50 82",
  "M50 12 L86 80 L14 80 Z M42 58 A8 8 0 1 0 58 58 A8 8 0 1 0 42 58",
  "M50 44 A6 6 0 1 1 44 50 A12 12 0 1 1 56 62 A18 18 0 1 1 38 38",
  "M50 8 L50 92 M18 50 L82 50 M30 22 A28 28 0 0 0 70 22",
];
