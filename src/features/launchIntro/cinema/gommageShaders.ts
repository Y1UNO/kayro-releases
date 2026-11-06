import { PAINT } from "../gommage";
import { NOISE } from "./backShader";

const v3 = (c: readonly number[]) => `vec3(${c.map((x) => x.toFixed(3)).join(", ")})`;

/**
 * The spotlight from above, shared by the back and the petals (q: in units of the window's
 * height from the card's centre): x = its cone, y = its pool of light under the card, z = the
 * angle from its apex (for its rays).
 */
const SPOT = `
float sq(float x) { return x * x; }
vec3 spot(vec2 q) {
  vec2 rl = q - vec2(0.05, -1.15);
  float ang = atan(rl.x, rl.y);
  float cone = (1.0 - smoothstep(0.09, 0.26, abs(ang + 0.04))) * smoothstep(0.0, 0.5, rl.y)
             * exp(-length(rl) * 0.35);
  float pool = exp(-sq(q.x / 0.38) - sq((q.y - 0.3) / 0.075));
  return vec3(cone, pool, ang);
}
`;

/**
 * The « Gommage » scene's programs (gommage.ts, 3rd version): the back (a dark painted canvas;
 * the spotlight from above in rays and its dust; five brushstrokes with the relief of oil paint,
 * lit by the spotlight; the far monolith with its number painted in crimson and a few golden
 * cracks; gilded Art Nouveau corners and frame), the petals (instanced, turning in 3D, glowing,
 * lit up in the beam, a few out of focus; or carrying a piece of the card's poster), and the last
 * layer (vignette, golden flare, a flash of blank canvas, black).
 */
export const GBACK_UNIFORMS = [
  "uView",
  "uScale",
  "uO",
  "uT",
  "uK",
  "uMono",
  "uNumber",
  "uOrn",
] as const;

export const GBACK_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uView;
uniform float uScale;
uniform vec2 uO;
uniform float uT;
uniform vec4 uK;     // cover, light, strokes laid (0–1 over the five), filigree
uniform vec4 uMono;  // rise, number painted, glow, card erased
uniform sampler2D uNumber;
uniform sampler2D uOrn;
out vec4 outColor;
${NOISE}
${SPOT}
const vec3 CHARCOAL = ${v3(PAINT.charcoal)};
const vec3 UMBER = ${v3(PAINT.umber)};
const vec3 OCHRE = ${v3(PAINT.ochre)};
const vec3 GOLD = ${v3(PAINT.gold)};
const vec3 CREAM = ${v3(PAINT.cream)};
const vec3 CRIMSON = ${v3(PAINT.crimson)};
const vec3 BRICK = ${v3(PAINT.brick)};

// One brushstroke from its start to its end (centre c, angle a, length L, width W, bent by b),
// laid up to rev (0–1). x: paint (0–1); y: its bristles' streaks (0–1); z: its edges, lit on the
// side facing the spotlight and shadowed on the other (−1…1); w: how loaded the brush still is.
vec4 stroke(vec2 q, vec2 c, float a, float L, float W, float b, float rev, float seed) {
  vec2 d = vec2(cos(a), sin(a));
  vec2 n = vec2(-d.y, d.x);
  vec2 r = q - c;
  float u = dot(r, d) / L + 0.5;
  if (u < 0.0 || u > 1.0 || rev <= 0.0) return vec4(0.0);
  float v = (dot(r, n) - b * (u - 0.5) * (u - 0.5) * L) / (W * 0.5);
  if (abs(v) > 1.2) return vec4(0.0);
  // Its outline: a flat brush's start (each bristle touching down a little apart, its corners
  // rounded), a slight swell, thinner towards its end.
  float s0 = (0.04 + 0.12 * noise(vec2(v * 19.0, seed + 9.0))) * W / L;
  float cap = clamp((u - s0) * L / (W * 0.4), 0.0, 1.0);
  float w = pow(1.0 - pow(1.0 - cap, 3.0), 0.33);
  w *= (1.0 - 0.5 * smoothstep(0.3, 1.0, u)) * (1.0 + (noise(vec2(u * L * 2.5, seed)) - 0.5) * 0.16);
  // Bristles: fine streaks along it. The paint runs out towards its end and its edges: only the
  // strongest streaks are left there, each one stopping at its own length.
  float streak = noise(vec2(v * 17.0 + seed * 7.0, u * L * 1.2)) * 0.6
               + noise(vec2(v * 43.0 + seed * 3.0, u * L * 2.5)) * 0.4;
  float side = abs(v) / max(w, 0.05);
  float load = clamp(1.0 - 0.85 * smoothstep(0.4, 1.0, u) - 0.4 * smoothstep(0.55, 1.0, side), 0.0, 1.0);
  float t0 = mix(0.68, -0.1, load);
  float dry = smoothstep(t0 - 0.05, t0 + 0.05, streak);
  float end = 0.88 + 0.12 * noise(vec2(v * 21.0, seed));
  float inside = (1.0 - smoothstep(w - 0.05, w, abs(v))) * (1.0 - smoothstep(end - 0.04, end, u));
  // Laid in one gesture (faster in its middle), its head a little uneven.
  float g = clamp(rev, 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g);
  float head = g * 1.04 + (noise(vec2(v * 5.0, seed + 3.0)) - 0.5) * 0.05;
  float laid = 1.0 - smoothstep(head - 0.02, head, u);
  float rim = smoothstep(0.5, 0.95, side) * -sign(v) * n.y;
  return vec4(inside * dry * laid, streak, rim, load);
}

// Lays a stroke of colour col over base: thick paint where the brush was loaded, thinner where it
// ran dry (the canvas shows through), faint streaks; dimmer in the shadow, its edge facing the
// spotlight catching the light (lit: 0 in the dark, 1 in it).
vec3 paint(vec3 base, vec3 col, vec4 s, float lit) {
  vec3 c = col * (0.84 + 0.3 * s.y) * (0.7 + 0.45 * lit);
  c *= 1.0 + s.z * (0.15 + 0.35 * lit);
  c += mix(col, CREAM, 0.5) * max(s.z, 0.0) * 0.2 * lit;
  return mix(base, c, s.x * mix(0.6, 0.95, s.w));
}

// Cracks in the stone: the borders of a cell pattern (one random point per cell), thin.
float crack(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int k = -1; k <= 1; k++) {
      vec2 g = vec2(float(k), float(y));
      float d = length(g + vec2(hash(i + g), hash(i + g + 7.3)) - f);
      d2 = d < d1 ? d1 : min(d2, d);
      d1 = min(d1, d);
    }
  }
  return 1.0 - smoothstep(0.0, 0.07, d2 - d1);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
  float H = uView.y;
  vec2 q = (p - uO) / H;
  vec3 sp = spot(q);
  float rays = 0.45 + 0.9 * noise(vec2(sp.z * 46.0, uT * 0.25)) * noise(vec2(sp.z * 13.0 + 4.0, uT * 0.1));
  float lit = clamp((sp.x * 1.6 + sp.y * 0.6 + 0.3 * exp(-dot(q, q) * 1.6)) * uK.y, 0.0, 1.0);
  // The canvas: near black, a fine grain of woven cloth.
  float grain = noise(p * 0.35) * 0.5 + noise(p * 1.1) * 0.5;
  vec3 c = CHARCOAL * (0.85 + 0.3 * grain);
  // Five strokes, one after the other (umber, ochre, gold, brick, crimson).
  float k = uK.z * 5.0;
  c = paint(c, UMBER, stroke(q, vec2(-0.5, -0.2), -0.14, 1.15, 0.17, 0.18, k, 1.0), lit);
  c = paint(c, OCHRE, stroke(q, vec2(0.42, 0.2), 0.1, 1.05, 0.13, -0.15, k - 1.0, 2.0), lit);
  c = paint(c, GOLD * 0.75, stroke(q, vec2(-0.05, 0.36), -0.05, 1.45, 0.07, 0.1, k - 2.0, 3.0), lit);
  c = paint(c, BRICK, stroke(q, vec2(0.62, -0.34), 0.21, 0.8, 0.11, 0.12, k - 3.0, 4.0), lit);
  // The crimson slash behind the card goes with it in the Gommage, in specks.
  vec4 slash = stroke(q, vec2(0.12, -0.06), -0.89, 0.85, 0.06, -0.1, k - 4.0, 5.0);
  slash.x *= 1.0 - smoothstep(-0.1, 0.0, uMono.w - 0.25 - 0.7 * noise(q * 38.0));
  c = paint(c, CRIMSON * 0.85, slash, lit);
  // The far monolith rising out of the haze, on the left: a tapering spire broken at its top,
  // a warm backlight, a rim of light on its side facing the spotlight.
  float rise = uMono.x;
  vec2 m = q - vec2(-0.62, 0.3 + (1.0 - rise) * 0.6);
  float back = exp(-sq(m.x / 0.3)) * smoothstep(-1.1, -0.3, m.y) * (1.0 - smoothstep(-0.1, 0.25, m.y));
  c += UMBER * 0.95 * back * rise;
  float hgt = 0.72;
  float yy = clamp(-m.y / hgt, 0.0, 1.0);
  float hw = mix(0.1, 0.056, yy) + (noise(vec2(m.y * 30.0, 7.0)) - 0.5) * 0.004;
  float xw = m.x + 0.02 * yy;
  float topY = -hgt + 0.7 * (xw + hw) + (noise(vec2(xw * 60.0, 3.0)) - 0.5) * 0.03;
  float slab = step(abs(xw), hw) * step(topY, m.y) * step(m.y, 0.0) * rise;
  float haze = 1.0 - smoothstep(-0.35, 0.0, m.y);
  vec3 stone = mix(vec3(0.05, 0.046, 0.043), vec3(0.09, 0.082, 0.075), noise(vec2(m.x * 90.0, m.y * 6.0)));
  stone *= 0.85 + 0.3 * noise(vec2(xw * 140.0, m.y * 3.0));
  stone += GOLD * 0.4 * smoothstep(hw - 0.012, hw, xw) * uK.y;
  c = mix(c, stone, slab * (0.35 + 0.65 * haze));
  // Its number, painted in crimson with a brush (only inside its drawing: no stretched edges),
  // and a few golden cracks spreading round it.
  vec2 nuv = vec2(xw / (hw * 1.6) * 0.5 + 0.5, (m.y + 0.42) / 0.24 + 0.5);
  vec2 box = step(vec2(0.0), nuv) * step(nuv, vec2(1.0));
  vec2 soft = smoothstep(vec2(-0.1), vec2(0.08), nuv) * (1.0 - smoothstep(vec2(0.92), vec2(1.1), nuv));
  float wipe = uMono.y * 1.2 - nuv.x - (noise(vec2(nuv.y * 9.0, 4.0)) - 0.5) * 0.12;
  float shown = smoothstep(0.0, 0.04, wipe);
  float ink = textureLod(uNumber, nuv, 0.0).a * shown * box.x * box.y;
  float glow = textureLod(uNumber, nuv, 3.0).a * shown * soft.x * soft.y;
  float brush = 0.75 + 0.35 * noise(vec2(nuv.x * 40.0, nuv.y * 8.0));
  c = mix(c, CRIMSON * brush * (0.9 + 0.5 * uMono.z), ink * slab);
  c += CRIMSON * glow * 0.45 * uMono.z * rise;
  float reach = (1.0 - smoothstep(0.06, 0.2, length((m - vec2(0.0, -0.42)) * vec2(1.4, 0.9)))) * uMono.y * slab;
  if (reach > 0.0) {
    vec2 cp = m * 26.0 + (vec2(noise(m * 60.0), noise(m * 60.0 + 3.7)) - 0.5) * 0.35;
    float web = crack(cp) * step(0.42, noise(m * 9.0 + 2.0));
    c += GOLD * web * reach * 0.8 * uMono.z;
  }
  // Haze at the foot of the scene.
  c = mix(c, UMBER * 0.6, smoothstep(0.15, 0.55, q.y) * 0.35 * rise);
  // The light itself: its rays, its dust (round motes drifting up, one at most per cell).
  vec2 gq = p / 26.0 + vec2(uT * 0.12, -uT * 0.32);
  vec2 id = floor(gq);
  vec2 fp = fract(gq) - 0.5 - (vec2(hash(id), hash(id + 17.0)) - 0.5) * 0.6;
  float dust = step(0.8, hash(id + 41.0)) * exp(-dot(fp, fp) * 70.0)
             * (0.6 + 0.4 * sin(uT * 2.0 + hash(id) * 6.28)) * 2.4;
  c += GOLD * uK.y * (sp.x * (0.3 * rays + dust) + sp.y * 0.18);
  // Darker away from the light.
  c *= mix(1.0, 0.55 + 0.45 * exp(-dot(q, q) * 1.1), uK.y);
  // Gilded corners (one ornament, mirrored) and a fine frame, drawn from the corners.
  vec2 cq = vec2(min(p.x, uView.x - p.x), min(p.y, uView.y - p.y)) / (H * 0.34);
  float orn = textureLod(uOrn, clamp(cq, 0.0, 1.0), 0.0).a * step(max(cq.x, cq.y), 1.0);
  float reachO = length(cq) / 1.42;
  float drawn = smoothstep(reachO, reachO + 0.04, uK.w * 1.1);
  float headO = exp(-abs(reachO - uK.w * 1.1) * 30.0) * step(uK.w, 0.999);
  float sheen = 0.75 + 0.35 * sin((p.x + p.y) / H * 9.0 - uT * 1.4);
  vec2 inset = vec2(min(p.x, uView.x - p.x), min(p.y, uView.y - p.y)) - H * 0.04;
  float frameD = abs(min(inset.x, inset.y));
  float frame = (1.0 - smoothstep(0.6, 1.4, frameD)) * step(-0.5, min(inset.x, inset.y)) * uK.w * 0.55;
  c += GOLD * (orn * drawn * sheen + headO * orn * 1.5 + frame * sheen);
  c += (hash(gl_FragCoord.xy + uT) - 0.5) / 255.0;
  outColor = vec4(c * uK.x, uK.x);
}
`;

export const PETAL_UNIFORMS = ["uView", "uPoster", "uHas", "uO", "uLight"] as const;

/** Per petal: aI = x, y, size (px), turn (rad); aJ = flip (rad), alpha, blur, glow; aK = u, v, mix, colour. */
export const PETAL_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aI;
layout(location = 2) in vec4 aJ;
layout(location = 3) in vec4 aK;
uniform vec2 uView;
uniform vec2 uO;
uniform float uLight;
out vec2 vQ;
out float vSide;
out float vLit;
out vec4 vJ;
out vec4 vK;
${SPOT}
void main() {
  float flip = cos(aJ.x);
  // Room around the petal for its glow (the shape is −1…1 inside a −1.7…1.7 quad).
  vec2 local = vec2(aPos.x * max(abs(flip), 0.1), aPos.y) * aI.z * 0.5 * 1.7;
  float cs = cos(aI.w);
  float sn = sin(aI.w);
  vec2 px = aI.xy + vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);
  vec3 s = spot((aI.xy - uO) / uView.y);
  vLit = clamp(s.x * 1.5 + s.y * 0.6, 0.0, 1.0) * uLight;
  vQ = aPos * 1.7;
  vSide = sign(flip);
  vJ = aJ;
  vK = aK;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}
`;

export const PETAL_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vQ;
in float vSide;
in float vLit;
in vec4 vJ;
in vec4 vK;
uniform sampler2D uPoster;
uniform float uHas;
out vec4 outColor;
const vec3 PAL[4] = vec3[4](${v3(PAINT.crimson)}, ${v3(PAINT.brick)}, ${v3(PAINT.blush)}, ${v3(PAINT.gold)});
void main() {
  // A petal, tip up: narrower towards its notched tip, rounded at its base.
  vec2 q = vec2(vQ.x, -vQ.y);
  float w = 0.6 * (1.0 - 0.28 * q.y);
  float body = length(vec2(q.x / w, q.y * 0.98)) - 0.92;
  float notch = length(q - vec2(0.0, 1.0)) - 0.2;
  float d = max(body, -notch);
  float blur = max(vJ.z, fwidth(d) * 1.2);
  float a = (1.0 - smoothstep(-blur, blur, d)) * vJ.y;
  vec3 tint = PAL[int(vK.w)];
  vec3 col = vK.x >= 0.0 && uHas > 0.5 ? texture(uPoster, vK.xy).rgb : tint;
  col = mix(col, tint, vK.z);
  float vein = 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.07, abs(q.x))) * smoothstep(-0.9, 0.5, q.y);
  float base = 0.75 + 0.25 * smoothstep(-1.0, 0.2, q.y);
  col *= vein * base * (vSide > 0.0 ? 1.0 : 0.72);
  col += PAL[2] * 0.12 * (1.0 - smoothstep(0.0, 0.5, abs(q.x - 0.25))) * step(0.0, vSide);
  // In the spotlight's beam a petal lights up in gold and glows more.
  col = col * (0.8 + 0.5 * vLit) + PAL[3] * 0.12 * vLit;
  float room = 1.0 - smoothstep(1.25, 1.7, max(abs(vQ.x), abs(vQ.y)));
  float halo = exp(-max(d, 0.0) * 2.6) * (1.0 - a / max(vJ.y, 0.001)) * vJ.w * vJ.y * room;
  outColor = vec4(col * a + tint * halo * (0.3 + 0.35 * vLit), a);
}
`;

export const GFINAL_UNIFORMS = ["uView", "uScale", "uO", "uF"] as const;

export const GFINAL_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec2 uView;
uniform float uScale;
uniform vec2 uO;
uniform vec4 uF; // vignette, flare, flash, black
out vec4 outColor;
const vec3 GOLD = ${v3(PAINT.gold)};
const vec3 CREAM = ${v3(PAINT.cream)};
void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
  vec2 s = (p - uO) / uView.y;
  float vig = smoothstep(0.5, 1.25, length(s)) * uF.x * 0.7;
  // The spotlight flares at its source, then the blank canvas flashes (brighter in its middle).
  vec2 src = s - vec2(0.03, -0.55);
  float flare = exp(-dot(src, src) * 2.2) * uF.y * 0.6;
  float flash = uF.z * (0.75 + 0.25 * exp(-dot(s, s) * 4.0));
  vec3 c = GOLD * flare + mix(CREAM, GOLD, 0.25) * flash;
  float a = clamp(vig + flash, 0.0, 1.0);
  c *= 1.0 - uF.w;
  outColor = vec4(c, max(a, uF.w));
}
`;
