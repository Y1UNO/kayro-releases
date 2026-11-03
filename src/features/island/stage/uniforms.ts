/**
 * Kysland's music mode (the lab): what a scene hands the shaders each frame. The ink is one
 * distance field: a core (a circle deformed by its modes, edge ripples and shear), the island (a
 * rounded box against the screen's edges, with shoulders), and up to 32 balls, all merged by a
 * smooth union. The light: a halo, rays, three strings with plucks running round them, shock
 * waves. Logical px of the stage.
 */
export interface Uniforms {
  /** Balls: x, y, radius, merge factor. */
  balls: Float32Array;
  n: number;
  /** The smooth union's width (px). */
  k: number;
  /** The core: x, y, radius (0: none), on. */
  core: Float32Array;
  modeA: Float32Array;
  modeP: Float32Array;
  ripple: Float32Array;
  shear: Float32Array;
  /** The island: its box x0, y0, x1, y1 (0 wide: none), its corners' radius, its shoulders' width. */
  isle: Float32Array;
  isleR: Float32Array;
  /** The halo: strength, width (px), rays' strength, rim. */
  halo: Float32Array;
  /** Three strings: radius, strength, width, colour (0, 1: the two colours; 2: white). */
  rings: Float32Array;
  /** Plucks: string, angle, age, height (px). */
  pk: Float32Array;
  npk: number;
  waveA: Float32Array;
  waveB: Float32Array;
  nw: number;
  flash: number;
  ca: number;
  shake: Float32Array;
  /** The cover: radius, turn, presence (0–1), the hole's radius. */
  cover: Float32Array;
  /** The light's centre (its rays, its trails turn round it), and where it fades out (px). */
  fc: Float32Array;
  fade: number;
}

export function uniforms(): Uniforms {
  return {
    balls: new Float32Array(128),
    n: 0,
    k: 30,
    core: new Float32Array(4),
    modeA: new Float32Array(4),
    modeP: new Float32Array(4),
    ripple: new Float32Array(4),
    shear: new Float32Array(2),
    isle: new Float32Array(4),
    isleR: new Float32Array(4),
    halo: new Float32Array([0, 30, 0, 0]),
    rings: new Float32Array(12),
    pk: new Float32Array(64),
    npk: 0,
    waveA: new Float32Array(24),
    waveB: new Float32Array(24),
    nw: 0,
    flash: 0,
    ca: 0,
    shake: new Float32Array(2),
    cover: new Float32Array(4),
    fc: new Float32Array(2),
    fade: 1e5,
  };
}

/** Back to nothing before a scene fills it. */
export function clearUniforms(U: Uniforms, W: number, H: number): void {
  U.n = 0;
  U.core.fill(0);
  U.modeA.fill(0);
  U.modeP.fill(0);
  U.ripple.fill(0);
  U.shear.fill(0);
  U.isle.fill(0);
  U.isleR.fill(0);
  U.rings.fill(0);
  U.npk = 0;
  U.cover.fill(0);
  U.fc[0] = W / 2;
  U.fc[1] = H / 2;
  U.fade = 1e5;
}
