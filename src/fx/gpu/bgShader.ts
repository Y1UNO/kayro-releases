// Background pass of the glass engine (step 12b round 2), rendered into a texture that every glass
// element refracts: theme gradient, moon halo, two veils, light bands (thin bright cores: straight
// lines make the refraction readable), the cursor's soft light and the vignette. Then the
// particles (embers, stars, bokeh) as instanced sprites, added on top (additive blending).
// Coordinates: CSS pixels of the viewport, y down.

export const BG_UNIFORMS = [
  "uRes",
  "uView",
  "uBg0",
  "uBg1",
  "uBg2",
  "uRadial",
  "uA",
  "uB",
  "uMoon",
  "uAir",
  "uVeilA",
  "uVeilB",
  "uVeil",
  "uBands",
  "uBandT",
  "uLight",
  "uVig",
  "uLRing",
  "uLRing2",
  "uDrip",
] as const;

export const BG_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;      // target size (px)
uniform vec2 uView;     // viewport (CSS px)
uniform vec3 uBg0;
uniform vec3 uBg1;
uniform vec3 uBg2;
uniform float uRadial;  // 1 = radial (V4), 0 = linear (sketch)
uniform vec3 uA;
uniform vec3 uB;
uniform vec4 uMoon;     // centre x, y, radius, intensity
uniform vec2 uAir;      // moon glow spread 0–1, background lift 0–0.3 (round 2b, "plus aéré")
uniform vec4 uVeilA;    // centre x, y, radius x, radius y
uniform vec4 uVeilB;
uniform vec4 uVeil;     // rotation A, rotation B (rad), intensity A, intensity B
uniform vec4 uBands;    // count, intensity, width (px), angle (rad)
uniform float uBandT;   // travel phase 0–1
uniform vec4 uLight;    // cursor x, y, intensity (fade included), radius
uniform float uVig;     // vignette strength
uniform vec4 uLRing;    // liquid ring: centre x, y, radius, intensity (0 = off)
uniform vec4 uLRing2;   // thickness, glow width (px), highlight phase (rad), time (s)
uniform vec4 uDrip;     // drop: angle (rad), progress 0–1 (< 0: none), reach (px), -

vec3 base(vec2 p) {
  float t;
  if (uRadial > 0.5) t = length((p - vec2(uView.x * 0.5, 0.0)) / vec2(0.9 * uView.x, 0.75 * uView.y));
  else t = p.y / uView.y;
  float mid = uRadial > 0.5 ? 0.5 : 0.55;
  return t < mid ? mix(uBg0, uBg1, t / mid) : mix(uBg1, uBg2, clamp((t - mid) / (1.0 - mid), 0.0, 1.0));
}

float moon(vec2 p) {
  float t = length(p - uMoon.xy) / uMoon.z;
  float i = uMoon.w;
  // Spread moves the knee outwards and raises it: same centre, a wider and softer glow.
  float k = 0.55 + 0.15 * uAir.x;
  float m = (0.35 + 0.4 * uAir.x) * i;
  float u = clamp((t - k) / (1.0 - k), 0.0, 1.0);
  float a = t < k ? mix(i, m, t / k) : m * (1.0 - mix(u, smoothstep(0.0, 1.0, u), uAir.x));
  return t < 1.0 ? a : 0.0;
}

float veil(vec2 p, vec4 v, float rot) {
  vec2 d = p - v.xy;
  float c = cos(rot), s = sin(rot);
  d = mat2(c, -s, s, c) * d;
  return clamp(1.0 - length(d / v.zw), 0.0, 1.0);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Liquid ring: a thin line of light (signed distance to a circle whose radius wavers a little),
// two soft highlights travelling round it, and now and then a drop that swells out of the line,
// stretches, almost detaches and melts back (smooth union with a small ellipse).
vec3 liquidRing(vec2 p) {
  vec2 d = p - uLRing.xy;
  float r = length(d);
  float th = uLRing2.x;
  float reach = max(uDrip.z, 0.0) + uLRing2.y * 7.0 + 12.0;
  if (abs(r - uLRing.z) > reach) return vec3(0.0);
  float a = atan(d.y, d.x);
  float t = uLRing2.w;
  float wob = 0.7 * sin(a * 3.0 + t * 0.21) + 0.45 * sin(a * 5.0 - t * 0.13 + 1.7);
  float sd = abs(r - uLRing.z - wob) - th * 0.5;
  if (uDrip.y >= 0.0) {
    float pr = uDrip.y;
    float swell = smoothstep(0.0, 0.45, pr) * (1.0 - smoothstep(0.62, 1.0, pr));
    float apart = smoothstep(0.32, 0.52, pr) * (1.0 - smoothstep(0.55, 0.78, pr));
    vec2 dir = vec2(cos(uDrip.x), sin(uDrip.x));
    vec2 q = p - (uLRing.xy + dir * (uLRing.z + uDrip.z * swell));
    vec2 qr = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x)));
    float stretch = 1.0 + 0.9 * swell * (1.0 - apart);
    float blob = length(qr / vec2(stretch, 1.0)) - (th * 0.5 + uDrip.z * 0.15 * swell);
    float k = mix(uDrip.z * 0.55, max(uDrip.z * 0.06, 0.6), apart) + 0.001;
    sd = smin(sd, blob, k);
  }
  float o = max(sd, 0.0);
  float lum = exp(-o * o / 0.9) * 0.85 + exp(-o / max(uLRing2.y, 0.5)) * 0.4;
  float ph = uLRing2.z;
  float hl = 0.3 + 0.7 * pow(0.5 + 0.5 * cos(a - ph), 4.0)
    + 0.35 * pow(0.5 + 0.5 * cos(a + ph * 0.6 + 2.1), 6.0);
  vec3 col = mix(mix(uA, uB, 0.5 + 0.5 * sin(a)), vec3(1.0), 0.45);
  return col * lum * hl * uLRing.w;
}

vec3 bands(vec2 p) {
  vec3 acc = vec3(0.0);
  vec2 dir = vec2(cos(uBands.w), sin(uBands.w));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 c = uView * vec2(0.5, 0.55);
  float span = length(uView);
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uBands.x) break;
    float fi = float(i);
    float e = fract(uBandT + fi * 0.29);
    float q = dot(p - c, nrm) - (e - 0.5) * span * 0.9;
    float w = uBands.z * (0.6 + 0.5 * fract(fi * 0.618));
    float along = dot(p - c, dir) / (span * 0.45);
    float lit = (exp(-q * q / (w * w)) + 0.45 * exp(-q * q / 5.0)) * exp(-along * along * 1.5);
    acc += mix(uA, uB, fi / 3.0) * lit * sin(e * 3.14159265);
  }
  return acc * uBands.y;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uView / uRes;
  vec3 c = base(p);
  c = mix(c, mix(uBg0, uA, 0.35), uAir.y);
  c = mix(c, uA, moon(p));
  c = mix(c, uA, veil(p, uVeilA, uVeil.x) * uVeil.z);
  c = mix(c, uB, veil(p, uVeilB, uVeil.y) * uVeil.w);
  c += bands(p);
  if (uLRing.w > 0.0) c += liquidRing(p);
  if (uLight.z > 0.0) {
    vec2 d = (p - uLight.xy) / uLight.w;
    c += mix(vec3(1.0), mix(uA, uB, 0.5), 0.45) * uLight.z * 0.32 * exp(-dot(d, d) * 2.2);
  }
  // CSS vignette: ellipse at 50% 42%, clear until 48 %, then towards rgb(4, 2, 8).
  vec2 v = (p - uView * vec2(0.5, 0.42)) / (uView * vec2(0.5, 0.58));
  float t = length(v) / 1.41421356;
  c = mix(c, vec3(4.0, 2.0, 8.0) / 255.0, uVig * clamp((t - 0.48) / 0.52, 0.0, 1.0));
  outColor = vec4(c, 1.0);
}
`;

export const SPRITE_UNIFORMS = [
  "uView",
  "uStar",
  "uMoon",
  "uLight",
  "uLRing",
  "uPLight",
  "uPar",
] as const;

/** Per instance: aI = x, y, size (CSS px), alpha; aC = rgb, kind (0 ember, 1 star, 2 bokeh). */
export const SPRITE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aI;
layout(location = 2) in vec4 aC;
uniform vec2 uView;
uniform vec4 uMoon;    // as in the background pass
uniform vec4 uLight;   // cursor x, y, intensity (fade included), radius
uniform vec4 uLRing;   // liquid ring centre x, y, radius, intensity
uniform vec4 uPLight;  // lit particles (round 2b): intensity, reach, halo, 0
uniform vec2 uPar;     // parallax shift of the nearest layer (px); stars far, bokeh mid, embers near
out vec2 vUv;
out vec4 vC;
out float vA;
// Light received at q from the engine's lights (embers and stars only, not the bokeh).
float received(vec2 q) {
  float r = uPLight.y;
  vec2 dm = (q - uMoon.xy) / (uMoon.z * r);
  float m = uMoon.w * 1.6 * exp(-dot(dm, dm) * 1.5);
  float dr = (length(q - uLRing.xy) - uLRing.z) / (60.0 * r);
  float g = uLRing.w * 1.8 * exp(-dr * dr);
  vec2 dc = (q - uLight.xy) / (uLight.w * r);
  float c = uLight.z * 2.6 * exp(-dot(dc, dc) * 2.0);
  return min(m + g + c, 1.5);
}
void main() {
  float depth = aC.w < 0.5 ? 1.0 : (aC.w < 1.5 ? 0.35 : 0.65);
  vec2 q = aI.xy + uPar * depth;
  float lit = (aC.w < 1.5 && uPLight.x > 0.0) ? received(q) * uPLight.x : 0.0;
  vec2 p = q + aPos * aI.z * 0.5 * (1.0 + uPLight.z * lit);
  vUv = aPos;
  vC = vec4(mix(aC.rgb, vec3(1.0), 0.35 * min(lit, 1.0)), aC.w);
  vA = aI.w * (1.0 + 1.2 * lit);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}
`;

export const SPRITE_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
in vec4 vC;
in float vA;
uniform vec3 uStar;
out vec4 outColor;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  vec3 col = vC.rgb;
  float a;
  if (vC.w < 0.5) {
    a = smoothstep(0.3, 0.16, r) + 0.6 * exp(-r * r * 5.0) * (1.0 - r);
  } else if (vC.w < 1.5) {
    float core = smoothstep(0.32, 0.18, r);
    a = core + 0.6 * exp(-r * r * 5.0) * (1.0 - r);
    col = mix(vC.rgb, uStar, core);
  } else {
    a = smoothstep(1.0, 0.86, r) * (0.55 + 0.45 * smoothstep(0.55, 0.95, r));
  }
  a *= vA;
  outColor = vec4(col * a, a);
}
`;
