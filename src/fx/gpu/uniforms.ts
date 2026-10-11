import { GLASS_KIND_ELEMENT } from "../../design/da/catalogueGlass";
import type { IntroFrame } from "./cues";
import { sheenAt, STILL_AT, STILL_DIM } from "./sheen";
import type { GlassKind } from "../../design/glass/glassRegistry";
import { pingPong } from "../css/drift";
import type { FxPalette, FxParams } from "../FxLayer";
import { KIND_INDEX } from "./glassFrame";
import { dropAt, ringPhase } from "./liquidRing";
import type { PointerLight } from "./pointer";
import type { Uniforms } from "./renderer";
import type { Scene } from "./scene";

type Values = Readonly<Record<string, number | boolean | string>>;
export const num = (v: Values | undefined, k: string, d: number) =>
  typeof v?.[k] === "number" ? (v[k] as number) : d;

const RING_MARGIN = 48;
const DEG = Math.PI / 180;

export interface View {
  /** Viewport, CSS px. */
  W: number;
  H: number;
  /** Target size, px. */
  w: number;
  h: number;
}

const rgb = (c: readonly number[]) => [c[0]! / 255, c[1]! / 255, c[2]! / 255];

/** Glossy veil position (−1 = resting / off) at engine time `now` (ms). */
export function sheenPos(p: FxParams, now: number, reduced: boolean): number {
  const s = p.cardSheen;
  if (s?.on !== true) return -1;
  return reduced ? STILL_AT : sheenAt(now, num(s, "duration", 1800));
}

/** Glossy veil uniforms for the selected card's box (`box` = centre, half size). */
export function sheenUniforms(
  p: FxParams,
  pos: number,
  box: Float32Array | null,
  reduced: boolean,
) {
  const s = p.cardSheen;
  const on = box !== null && pos >= 0;
  const half = box ? (num(s, "width", 28) / 100) * (box[2]! + box[3]!) * 0.5 : 0;
  return {
    uSheen: [
      on ? pos : -1,
      num(s, "intensity", 0.3) * (reduced ? STILL_DIM : 1),
      half,
      num(s, "angle", 18) * DEG,
    ],
    uSheenBox: box ? Array.from(box) : [0, 0, 0, 0],
  };
}

/** Poster textures: refraction (× the rim's), reflection on the rim. */
export function posterK(p: FxParams): number[] {
  const g = p.posterGlass;
  return [num(g, "refraction", 1), num(g, "reflection", 0.35)];
}

/** Parallax of the particles (px, nearest layer), or 0 (matter off, reduced motion). */
export function parallaxPx(p: FxParams, reduced: boolean): number {
  return p.matter?.on === true && !reduced ? num(p.matter, "parallax", 12) : 0;
}

/** Cursor light uniform: x, y, intensity (fade included), radius. */
export function lightOf(p: FxParams, pointer: PointerLight): number[] {
  const c = p.cursorLight;
  const on = c?.on === true && pointer.level > 0;
  return [
    pointer.x,
    pointer.y,
    on ? num(c, "intensity", 0.3) * pointer.level : 0,
    num(c, "radius", 300),
  ];
}

export function bgUniforms(
  p: FxParams,
  pal: FxPalette,
  bg: readonly (readonly number[])[],
  scene: Scene,
  light: number[],
  v: View,
  k0: number,
  ring: boolean,
  intro: IntroFrame | null = null,
): Uniforms {
  const { W, H } = v;
  // During the opening the home layers wait (`home` 0 → 1 in its hand-off).
  const k = k0 * (intro ? intro.home : 1);
  const t = scene.drifting ? scene.time : 0;
  const moon = p.moonHalo;
  const veils = p.veils;
  const bands = p.lightBands;
  const mSize = num(moon, "size", 600);
  const mu = scene.drifting ? pingPong(t, num(moon, "period", 9) * 1000) : 0;
  const amp = veils?.on ? num(veils, "amplitude", 80) : 0;
  const ua = scene.drifting ? pingPong(t, num(veils, "periodA", 30) * 1000) : 0;
  const ub = scene.drifting ? pingPong(t, num(veils, "periodB", 36) * 1000) : 0;
  const backdrop = p.backdrop;
  return {
    uRes: [v.w, v.h],
    uView: [W, H],
    uBg0: bg[0] ?? [0, 0, 0],
    uBg1: bg[1] ?? [0, 0, 0],
    uBg2: bg[2] ?? [0, 0, 0],
    uRadial: backdrop?.on !== false && backdrop?.shape !== "lineaire" ? 1 : 0,
    uA: rgb(pal.a),
    uB: rgb(pal.b),
    uMoon: [
      W / 2,
      num(moon, "top", -170) + mSize / 2,
      (mSize / 2) * (1 + num(moon, "breathe", 0.04) * mu),
      moon?.on ? num(moon, "intensity", 0.34) * (0.8 + 0.2 * mu) * k : 0,
    ],
    uAir: [
      moon?.on ? num(moon, "spread", 0) : 0,
      backdrop?.on !== false ? num(backdrop, "lift", 0) * k0 : 0,
    ],
    uVeilA: [
      W / 2 + (-amp + 2 * amp * ua),
      (num(veils, "topA", 43) / 100 + 0.145) * H,
      0.66 * W,
      0.145 * H,
    ],
    uVeilB: [
      W / 2 + (amp - 2 * amp * ub),
      (num(veils, "topB", 60) / 100 + 0.16) * H,
      0.66 * W,
      0.16 * H,
    ],
    uVeil: [
      -6 * DEG,
      5 * DEG,
      veils?.on ? num(veils, "intensityA", 0.16) * k : 0,
      veils?.on ? num(veils, "intensityB", 0.14) * k : 0,
    ],
    uBands: [
      bands?.on ? num(bands, "count", 3) : 0,
      num(bands, "intensity", 0.1) * k,
      num(bands, "width", 70),
      num(bands, "angle", -24) * DEG,
    ],
    uBandT: (t / (num(bands, "period", 70) * 1000)) % 1,
    uLight: light,
    uVig: backdrop?.on !== false ? num(backdrop, "vignette", 0.55) : 0.62,
    ...liquidRingUniforms(p, t, v, k, ring),
    ...introUniforms(intro),
  };
}

/** Opening uniforms (round 3): nothing drawn when `intro` is null. */
export function introUniforms(intro: IntroFrame | null): Uniforms {
  if (!intro)
    return { uIntro: 1, uIHalo: [0, 0, 1, 0], uIRing: [0, 0, 1, 0], uIRing2: [0, 0, 0, 1] };
  return { uIntro: intro.fade, uIHalo: intro.halo, uIRing: intro.ring, uIRing2: intro.draw };
}

/** Opacity of the embers, stars and bokeh (the opening fades them in; 1 otherwise). */
export function kindUniform(intro: IntroFrame | null): number[] {
  return intro ? [intro.embers, intro.fade, intro.fade * intro.home] : [1, 1, 1];
}

/** The liquid ring is drawn (its element and the crystal ring's geometry on). */
export function liquidRingOn(p: FxParams): boolean {
  return p.liquidRing?.on === true && p.crystalRing?.on === true;
}

function liquidRingUniforms(p: FxParams, t: number, v: View, k: number, ring: boolean): Uniforms {
  const c = p.crystalRing;
  const l = p.liquidRing;
  const on = ring && liquidRingOn(p);
  const size = num(c, "size", 680);
  const drop = on ? dropAt(t, num(l, "dripRate", 1.2)) : null;
  return {
    uLRing: [
      v.W / 2 + num(c, "offsetX", 0),
      num(c, "top", -230) + size / 2,
      size / 2,
      on ? num(l, "intensity", 0.32) * k : 0,
    ],
    uLRing2: [
      num(l, "thickness", 1.2),
      num(l, "blur", 9),
      ringPhase(t, num(l, "speed", 0.5)),
      t / 1000,
    ],
    uDrip: [drop?.angle ?? 0, drop ? drop.progress : -1, num(l, "dripAmount", 16), 0],
  };
}

export function spriteUniforms(p: FxParams, v: View): Uniforms {
  const c = p.stars?.color;
  const star =
    typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)
      ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
      : [244 / 255, 241 / 255, 250 / 255];
  const l = p.particleLight;
  const lit = l?.on === true;
  return {
    uView: [v.W, v.H],
    uStar: star,
    uPLight: [lit ? num(l, "intensity", 0.6) : 0, num(l, "reach", 1), num(l, "halo", 0.35), 0],
  };
}

/** The ring in the background texture, or null (ring off / fallen back). */
export function ringUniforms(
  p: FxParams,
  pal: FxPalette,
  scene: Scene,
  light: number[],
  v: View,
): Uniforms | null {
  const c = p.crystalRing;
  const g = p.glassRing;
  const e = p.glassEngine;
  if (c?.on !== true || g?.on !== true) return null;
  const size = num(c, "size", 680);
  const cx = v.W / 2 + num(c, "offsetX", 0);
  const top = num(c, "top", -230);
  const period = num(c, "period", 40) * 1000;
  const t = scene.drifting ? scene.time : 0;
  const box = size / 2 + RING_MARGIN;
  return {
    uRes: [v.w, v.h],
    uView: [v.W, v.H],
    uBox: [cx - box, top + size / 2 - box, cx + box, top + size / 2 + box],
    uRing: [cx, top + size / 2, size / 2, num(g, "band", 26)],
    uA: rgb(pal.a),
    uB: rgb(pal.b),
    uP: [
      num(e, "refraction", 0.6) * num(g, "refraction", 1.2),
      num(e, "dispersion", 0.55) * num(g, "dispersion", 1.2),
      num(e, "blur", 0.22) * num(g, "blur", 0.3),
      num(e, "spec", 0.8) * num(g, "spec", 1),
    ],
    uE: [
      num(c, "edge", 0.42) * num(g, "bevel", 1) * (0.5 + num(e, "bevel", 0.75)),
      num(c, "fringe", 0.5),
      num(c, "glow", 0.18),
      (2 * Math.PI * (t % period)) / period,
    ],
    uLight: light,
    uSpec: p.cursorLight?.on ? num(p.cursorLight, "spec", 0.6) : 0,
  };
}

const KA = new Float32Array(4 * Object.keys(KIND_INDEX).length);
const KB = new Float32Array(4 * Object.keys(KIND_INDEX).length);

/** Is this kind drawn by the engine (its element on)? */
export function kindOn(p: FxParams, kind: GlassKind): boolean {
  return p[GLASS_KIND_ELEMENT[kind]]?.on === true;
}

export function kindTint(p: FxParams, kind: GlassKind): number {
  return num(p[GLASS_KIND_ELEMENT[kind]], "tint", 0.2);
}

/** Glass pass uniforms other than the shapes. */
export function glassUniforms(p: FxParams, light: number[], pal: FxPalette, v: View): Uniforms {
  const e = p.glassEngine;
  for (const kind of Object.keys(KIND_INDEX) as GlassKind[]) {
    const f = p[GLASS_KIND_ELEMENT[kind]];
    const o = KIND_INDEX[kind] * 4;
    const x = (key: string, d: number) => num(e, key, d) * num(f, key, 1);
    KA.set([x("refraction", 0.6), x("thickness", 14), x("dispersion", 0.55), x("blur", 0.22)], o);
    // Specular exponent: 30 (wide, soft) … 300 (thin, crisp).
    const sharp = 30 + 270 * num(e, "sharpness", 0.75);
    KB.set([x("bevel", 0.55), x("spec", 0.8), x("shadow", 0.5), sharp], o);
  }
  const a = rgb(pal.a);
  return {
    uRes: [v.w, v.h],
    uView: [v.W, v.H],
    uKA: KA,
    uKB: KB,
    uFusion: num(e, "fusion", 16),
    uLight: light,
    uSpec: p.cursorLight?.on ? num(p.cursorLight, "spec", 0.6) : 0,
    uLightCol: [0.85 + 0.15 * a[0]!, 0.85 + 0.15 * a[1]!, 0.85 + 0.15 * a[2]!],
    uMatter: p.matter?.on
      ? [num(p.matter, "rimGrain", 0.35), num(p.matter, "rimDepth", 0.4)]
      : [0, 0],
  };
}
