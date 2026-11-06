/**
 * The shaders of the tutorial's hand (handInk.ts), in Kayro's look (DESIGN.md § 1: a night in
 * the theme's colour, a moon, a thin ring of light, rims A → B, one hue). Three passes:
 * - NIGHT: the theme's night, the moon's halo, the ring, a few bokeh discs;
 * - HAND: the hand model (model/right.glb) skinned on its 25 bones, lit by the moon: the skin is
 *   the night lifted towards the theme's colour, fine engraved lines of light on its lit side,
 *   a rim of light A → B on its edges;
 * - GLOW (added): at a click, the cursor's glow and a ripple leaving the fingers.
 */

export const QUAD = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const NIGHT = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uA;
uniform vec3 uB;
out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  float pix = 2.0 / uRes.y;
  vec3 col = mix(uBottom, uTop, clamp(uv.y * 0.5 + 0.5, 0.0, 1.0));
  vec2 moon = uv - vec2(0.15, 1.2);
  col += mix(uA, vec3(1.0), 0.2) * 0.26 * exp(-dot(moon, moon) * 1.6);
  // The ring: a circle round the moon, light that runs slowly along it.
  float ring = abs(length(uv - vec2(0.15, 1.55)) - 1.25);
  float run = 0.55 + 0.45 * sin(atan(uv.y - 1.55, uv.x - 0.15) * 3.0 + uTime * 0.35);
  col += mix(uA, uB, 0.5 + 0.5 * uv.x) * (exp(-ring / (1.4 * pix)) * 0.55 + exp(-ring * 9.0) * 0.12) * run;
  for (int i = 0; i < 5; i++) {
    float f = float(i);
    vec2 at = vec2(sin(f * 2.4 + uTime * 0.05) * 1.1, cos(f * 1.7 + uTime * 0.04) * 0.75 - 0.1);
    float r = 0.12 + 0.05 * fract(f * 0.37);
    col += mix(uA, uB, fract(f * 0.53)) * (1.0 - smoothstep(r * 0.8, r, length(uv - at))) * 0.06;
  }
  // Dither: no bands in the dark gradient.
  outColor = vec4(col + (hash(gl_FragCoord.xy) - 0.5) / 255.0, 1.0);
}`;

export const HAND_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
layout(location = 2) in uvec4 aBone;
layout(location = 3) in vec4 aWeight;
uniform mat4 uBones[25];
uniform mat4 uProj;
uniform float uEye;
out vec3 vPos;
out vec3 vNor;
// How much the wrist's bone holds this vertex: the model stops at the wrist, the cut fades out.
out float vWrist;
void main() {
  mat4 m = aWeight.x * uBones[aBone.x] + aWeight.y * uBones[aBone.y]
    + aWeight.z * uBones[aBone.z] + aWeight.w * uBones[aBone.w];
  vec4 p = m * vec4(aPos, 1.0);
  vPos = p.xyz;
  vNor = mat3(m) * aNor;
  vWrist = dot(aWeight, vec4(equal(aBone, uvec4(0u))));
  gl_Position = uProj * vec4(p.xyz - vec3(0.0, 0.0, uEye), 1.0);
}`;

export const HAND_FS = `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vNor;
in float vWrist;
uniform vec2 uRes;
uniform float uEye;
uniform vec3 uBottom;
uniform vec3 uA;
uniform vec3 uB;
uniform float uCamera;
out vec4 outColor;

void main() {
  vec3 n = normalize(vNor);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vec3(0.0, 0.0, uEye) - vPos);
  float facing = clamp(dot(n, v), 0.0, 1.0);
  // The moon, above and in front; a soft fill from below so nothing goes black.
  vec3 l = normalize(vec3(-0.25, 0.75, 0.6));
  float light = max(dot(n, l), 0.0);
  float fill = max(dot(n, normalize(vec3(0.4, -0.5, 0.75))), 0.0) * 0.25;
  vec3 skin = mix(mix(uBottom, uA, 0.34), mix(uA, vec3(1.0), 0.38), 0.12 + 0.6 * light + fill);
  // Engraved lines of light, bent by the form (the normal shifts them), as thick as the light.
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  float c = dot(uv, vec2(0.38, 1.0)) * 74.0 + n.x * 1.4 + n.y * 0.8;
  float d = abs(fract(c) - 0.5) * 2.0;
  float aa = fwidth(c) * 1.2;
  float width = 0.8 * smoothstep(0.3, 0.95, light);
  float lines = 1.0 - smoothstep(width - aa, width + aa, d);
  vec3 col = mix(skin, mix(uA, vec3(1.0), 0.7), lines * 0.6);
  // The rim of light A → B (Kayro's rims) on the edges that turn away.
  col += mix(uA, uB, clamp(0.5 + uv.y * 0.5, 0.0, 1.0)) * pow(1.0 - facing, 2.4) * 1.1;
  // The wrist melts into the night drawn behind (the model ends there): blended, not painted.
  outColor = vec4(col * mix(0.55, 1.0, uCamera), 1.0 - smoothstep(0.45, 0.95, vWrist));
}`;

export const GLOW = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uGlow;
uniform float uContact;
uniform vec2 uTouch;
out vec4 outColor;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  float pix = 2.0 / uRes.y;
  float r = length(uv - uTouch);
  vec3 col = uGlow * uContact * 0.8 * exp(-r * r / 0.01);
  float wave = fract(uTime * 1.2);
  col += uGlow * uContact * (1.0 - wave) * exp(-abs(r - (0.06 + 0.22 * wave)) / (1.6 * pix)) * 0.7;
  outColor = vec4(col, 1.0);
}`;
