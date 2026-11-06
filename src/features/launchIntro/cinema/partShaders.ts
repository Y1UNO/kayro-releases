import { NOISE } from "./backShader";

/**
 * The « Sceau » scene's other programs: the flames (instanced, cel-shaded in three tones: deep,
 * bright, pale core, with a soft halo), the embers (additive dots), and the last full-window
 * layer (vignette, pillar of light, flash, black). Positions in CSS px, y down. The card is
 * cardQuad.ts.
 */
const TO_CLIP = `
vec4 clipOf(vec2 px) {
  return vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}
`;

export const FLAME_UNIFORMS = ["uView", "uT", "uA", "uB"] as const;

/** Per flame: aI = foot x, foot y, width, height (px); aJ = seed, alpha, lean, light. */
export const FLAME_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aI;
layout(location = 2) in vec4 aJ;
uniform vec2 uView;
out vec2 vL;
out vec4 vJ;
${TO_CLIP}
void main() {
  // The quad spans x −1.6…1.6 (the flame is −1…1 wide: room for its sway), y 0…1.3 (up).
  vec2 L = vec2(aPos.x * 1.6, (aPos.y + 1.0) * 0.5 * 1.3);
  vec2 px = aI.xy + vec2(L.x * aI.z * 0.5 + aJ.z * L.y * L.y * aI.w * 0.3, -L.y * aI.w);
  vL = L;
  vJ = aJ;
  gl_Position = clipOf(px);
}
`;

export const FLAME_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vL;
in vec4 vJ;
uniform float uT;
uniform vec3 uA;
uniform vec3 uB;
out vec4 outColor;
${NOISE}
// One tongue: a drop with a round belly and a pointed tip, its edges wavy and its tip curling,
// rising from y = 0 to h; how deep inside it a point is (1 on its axis, 0 on its edge, < 0 out).
float tongue(vec2 L, float off, float h, float w, float ph, float t) {
  float y = L.y / h;
  if (y < 0.0 || y > 1.0) return -1.0;
  float curl = (noise(vec2(y * 1.6 - t * 1.5, ph)) - 0.5) * 1.1 * y * y;
  float wave = (noise(vec2(y * 4.0 - t * 2.6, ph + 9.0)) - 0.5) * 0.35 * y;
  float x = L.x - off - (curl + wave) * w;
  float belly = sqrt(clamp(y / 0.3, 0.0, 1.0));
  float taper = pow(clamp((1.0 - y) / 0.7, 0.0, 1.0), 0.85);
  float prof = w * belly * taper;
  return prof > 0.0 ? 1.0 - abs(x) / prof : -1.0;
}
// A flame's silhouette: a main tongue and two smaller ones on its sides.
float flame(vec2 L, float h, float w, float ph, float t) {
  float d = tongue(L, 0.0, h, w, ph, t);
  d = max(d, tongue(L, -0.52 * w, h * (0.6 + 0.06 * sin(t * 7.7 + ph)), w * 0.6, ph + 3.1, t));
  return max(d, tongue(L, 0.56 * w, h * (0.54 + 0.06 * sin(t * 8.9 + ph)), w * 0.55, ph + 6.7, t));
}
float cel(float d) {
  float aa = fwidth(d) * 1.2;
  return smoothstep(-aa, aa, d);
}
void main() {
  float seed = vJ.x;
  float t = uT + seed * 7.3;
  vec2 L = vL;
  float h = 0.98 + 0.07 * sin(t * 6.1) + 0.04 * sin(t * 11.3);
  // Three nested flames, each smaller and lower: deep, bright, pale (the cel tones).
  float dOuter = flame(L, h, 1.0, seed, t);
  float dMid = flame(L, h * 0.66, 0.66, seed + 11.0, t * 1.1);
  float dCore = tongue(L, 0.0, h * 0.38, 0.4, seed + 23.0, t * 1.2);
  float outer = cel(dOuter);
  float mid = cel(dMid) * outer;
  float core = cel(dCore) * mid;
  vec3 deep = uA * 0.6;
  vec3 bright = mix(uA, uB, 0.4) * 1.05;
  vec3 pale = mix(uB, vec3(1.0), 0.5);
  vec3 c = mix(mix(deep, bright, mid), pale, core) * vJ.w;
  float a = outer * smoothstep(0.0, 0.05, L.y) * vJ.y;
  float halo = exp(min(dOuter, 0.0) * 2.5) * (1.0 - outer) * step(-0.999, dOuter) * 0.3 * vJ.y;
  outColor = vec4(c * a + uA * halo, a);
}
`;

export const EMBER_UNIFORMS = ["uView", "uB"] as const;

/** Per ember: aI = x, y, size (px), alpha. */
export const EMBER_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aI;
uniform vec2 uView;
out vec2 vUv;
out float vA;
${TO_CLIP}
void main() {
  vUv = aPos;
  vA = aI.w;
  gl_Position = clipOf(aI.xy + aPos * aI.z);
}
`;

export const EMBER_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
in float vA;
uniform vec3 uB;
out vec4 outColor;
void main() {
  float r = length(vUv);
  float a = exp(-r * r * 5.0) * (1.0 - smoothstep(0.8, 1.0, r)) * vA;
  outColor = vec4(mix(uB, vec3(1.0), 0.55) * a, 0.0);
}
`;

export const FINAL_UNIFORMS = ["uView", "uScale", "uO", "uA", "uB", "uF"] as const;

export const FINAL_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec2 uView;
uniform float uScale;
uniform vec2 uO;
uniform vec3 uA;
uniform vec3 uB;
uniform vec4 uF; // vignette, pillar, flash, black
out vec4 outColor;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
  vec2 s = p - uO;
  float r = length(s) / uView.y;
  float vig = smoothstep(0.45, 1.2, r) * uF.x * 0.75;
  float px = s.x / (uView.y * (0.035 + 0.05 * uF.y));
  float pillar = exp(-px * px) * uF.y * (0.7 + 0.3 * smoothstep(0.6, -0.4, s.y / uView.y));
  vec3 light = mix(uB, vec3(1.0), 0.55);
  float flash = uF.z * (0.55 + 0.45 * exp(-r * r * 5.0));
  vec3 c = light * pillar + light * flash;
  float a = clamp(vig + flash, 0.0, 1.0);
  c = c * (1.0 - uF.w);
  a = max(a, uF.w);
  outColor = vec4(c, a);
}
`;
