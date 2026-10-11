// Glass pass of the engine (step 12b round 2): full-screen composition onto the canvas. Outside
// the glass, a plain copy of the background texture. Each glass element is a rounded rectangle
// measured in the DOM; top-level ones are merged with a smooth union (two close shapes flow into
// each other, like a pill joining a bar), nested ones (buttons in a bar) form a second layer.
// Inside a shape, a lens profile over the rim thickness T: the background is pulled inwards
// following the slope of a round bevel (strong at the edge, neutral in the middle), one offset
// per colour channel (fine fringes), a little frost (mip levels), the tint, a crisp rim line,
// sharp speculars (fixed key light + the cursor light) and a soft shadow outside.

import { MAX_POSTERS } from "./posterTextures";

export const MAX_SHAPES = 24;
// Poster samplers (round 2b) and the constant branch that reads each one.
const units = Array.from({ length: MAX_POSTERS }, (_, i) => i);
const POSTER_SAMPLERS = units.map((i) => `uniform sampler2D uP${i};`).join("\n");
const POSTER_BRANCHES = units
  .map((i) => `  if (s == ${i}) return textureLod(uP${i}, uv, lod).rgb;`)
  .join("\n");

/** Glass kinds (card, bar, dock, button, pill): see KIND_INDEX in glassFrame.ts. */
export const KINDS = 5;

export const GLASS_UNIFORMS = [
  "uRes",
  "uView",
  "uTex",
  "uN",
  "uNested",
  "uR",
  "uS",
  "uT",
  "uC",
  "uKA",
  "uKB",
  "uFusion",
  "uLight",
  "uSpec",
  "uLightCol",
  "uMatter",
  "uSheen",
  "uSheenBox",
  "uPo",
  "uPosterK",
  ...Array.from({ length: MAX_POSTERS }, (_, i) => `uP${i}`),
] as const;

export const GLASS_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;

#define MAXS ${MAX_SHAPES}
#define NK ${KINDS}
uniform vec2 uRes;
uniform vec2 uView;
uniform sampler2D uTex;
uniform int uN;
uniform int uNested;       // 1 = some shapes are nested (second layer)
uniform vec4 uR[MAXS];     // centre x, y, half width, half height (CSS px)
uniform vec4 uS[MAXS];     // radius, kind, opacity, depth
uniform vec4 uT[MAXS];     // tint rgb, tint amount
uniform vec4 uC[MAXS];     // clip x0, y0, x1, y1
uniform vec4 uKA[NK];      // per kind: refraction, thickness (px), dispersion, frost (mip level)
uniform vec4 uKB[NK];      // per kind: bevel, specular, shadow, specular exponent (sharpness)
uniform float uFusion;     // smooth union radius (px)
uniform vec4 uLight;       // cursor x, y, intensity (fade included), radius
uniform float uSpec;       // cursor light on glass
uniform vec3 uLightCol;
uniform vec2 uMatter;      // round 2b: rim grain, rim depth (inner shadow + inner edge line)
uniform vec4 uSheen;       // glossy veil: position 0–1 (< 0: none), intensity, half width (px), angle
uniform vec4 uSheenBox;    // selected card: centre x, y, half width, half height
uniform vec4 uPo[MAXS];    // poster per shape: texture slot (< 0: none), picture w / h, opacity, inset
uniform vec2 uPosterK;     // poster: refraction (× the rim's), reflection on the rim
${POSTER_SAMPLERS}

// Samplers cannot be indexed by a variable in GLSL ES 3.00: one constant branch per texture unit.
vec3 posterTex(int s, vec2 uv, float lod) {
${POSTER_BRANCHES}
  return vec3(0.0);
}

// Like CSS object-fit: cover, for a picture of aspect ia in a box of half size hb.
vec2 coverUv(vec2 q, vec2 hb, float ia) {
  vec2 uv = q / (2.0 * hb) + 0.5;
  float ba = hb.x / hb.y;
  if (ia > ba) uv.x = 0.5 + (uv.x - 0.5) * ba / ia;
  else uv.y = 0.5 + (uv.y - 0.5) * ia / ba;
  return uv;
}

// Value noise on a 1.5 px lattice, stable on the glass (coordinates relative to its centre).
float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float grain(vec2 q) {
  vec2 i = floor(q / 1.5);
  vec2 f = fract(q / 1.5);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}

// Signed distance to a rounded box and its gradient (outwards).
vec3 sdg(vec2 p, vec2 b, float r) {
  vec2 s = sign(p);
  vec2 q = abs(p) - b + r;
  float g = max(q.x, q.y);
  vec2 m = max(q, 0.0);
  float l = length(m);
  vec2 n = g > 0.0 ? m / max(l, 1e-4) : (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  return vec3(min(g, 0.0) + l - r, s * n);
}

void field(vec2 p, float depth, out float D, out vec2 N, out vec4 KA, out vec4 KB, out vec4 T, out float A, out vec2 O, out int B) {
  D = 1e5; N = vec2(0.0, 1.0); KA = vec4(0.0); KB = vec4(0.0); T = vec4(0.0); A = 0.0; O = p; B = -1;
  float best = 1e5;
  float k = max(uFusion, 0.001);
  for (int i = 0; i < MAXS; i++) {
    if (i >= uN) break;
    vec4 s = uS[i];
    if (abs(s.w - depth) > 0.5) continue;
    vec4 c = uC[i];
    if (p.x < c.x || p.y < c.y || p.x > c.z || p.y > c.w) continue;
    vec4 r = uR[i];
    vec3 g = sdg(p - r.xy, r.zw, s.x);
    float h = clamp(0.5 + 0.5 * (D - g.x) / k, 0.0, 1.0);
    D = mix(D, g.x, h) - k * h * (1.0 - h);
    N = mix(N, g.yz, h);
    int kind = int(s.y + 0.5);
    KA = mix(KA, uKA[kind], h);
    KB = mix(KB, uKB[kind], h);
    T = mix(T, uT[i], h);
    A = mix(A, s.z, h);
    O = mix(O, r.xy, h);
    if (g.x < best) { best = g.x; B = i; }
  }
  float l = length(N);
  N = l > 1e-4 ? N / l : vec2(0.0, 1.0);
}

vec3 bgAt(vec2 p, float lod) {
  return textureLod(uTex, vec2(p.x / uView.x, 1.0 - p.y / uView.y), lod).rgb;
}

vec3 layer(vec3 under, vec2 p, float depth, float px) {
  float D; vec2 N; vec4 KA; vec4 KB; vec4 T; float A; vec2 O; int B;
  field(p, depth, D, N, KA, KB, T, A, O, B);
  if (A <= 0.0 || D > 48.0) return under;
  // Soft shadow, a little lower than the shape.
  float Ds = max(D - 6.0 * N.y, 0.0);
  vec3 c0 = under * (1.0 - KB.z * A * 0.5 * exp(-Ds / 16.0) * step(0.0, D));
  float cover = clamp(0.5 - D / px, 0.0, 1.0) * A;
  if (cover <= 0.0) return c0;

  float x = max(-D, 0.0);
  float th = max(KA.y, 1.0);
  float u = clamp(1.0 - x / th, 0.0, 1.0);        // 1 at the edge, 0 past the rim
  float bend = 1.0 - sqrt(1.0 - u * u);            // lens: neutral in the middle
  float slope = u / sqrt(max(1.0 - u * u, 0.03));
  vec2 off = -N * KA.x * th * 1.4 * bend;          // pulled inwards
  // Rim grain: the glass of the rim is not perfectly smooth (a little frost, light and shade).
  float gr = uMatter.x > 0.0 ? (grain(p - O) - 0.5) * uMatter.x * smoothstep(0.0, 0.25, u) : 0.0;
  off += vec2(gr, -gr) * 2.0;
  float disp = KA.z * 0.35;
  float lod = KA.w * 4.0 + bend * 0.6;
  vec3 col = vec3(
    bgAt(p + off * (1.0 + disp), lod).r,
    bgAt(p + off, lod).g,
    bgAt(p + off * (1.0 - disp), lod).b
  );
  col = mix(col, T.rgb, T.a) * 1.03 + 0.015 * (1.0 - T.a);
  if (depth < 0.5 && B >= 0 && uPo[B].x >= 0.0) {
    // The card's own poster under its glass (round 2b): bent by the rim's lens like the
    // background (one offset per colour channel), and mirrored faintly on the rim around it.
    vec4 P = uPo[B];
    vec4 r = uR[B];
    int sl = int(P.x + 0.5);
    vec2 hb = max(r.zw - P.w, vec2(1.0));
    vec2 q = p - r.xy;
    vec3 gp = sdg(q, hb, max(uS[B].x - P.w, 0.0));
    vec2 o = off * uPosterK.x;
    float lodP = bend * 2.0;
    vec3 pc = vec3(
      posterTex(sl, coverUv(q + o * (1.0 + disp), hb, P.y), lodP).r,
      posterTex(sl, coverUv(q + o, hb, P.y), lodP).g,
      posterTex(sl, coverUv(q + o * (1.0 - disp), hb, P.y), lodP).b
    );
    if (gp.x > 0.0 && uPosterK.y > 0.0) {
      vec2 qm = q - gp.yz * 2.0 * gp.x;
      vec3 rc = posterTex(sl, coverUv(qm, hb, P.y), 3.0);
      col = mix(col, rc, uPosterK.y * 0.6 * exp(-gp.x / 6.0));
    }
    col = mix(col, pc, clamp(0.5 - gp.x / px, 0.0, 1.0) * P.z);
  }

  vec3 n3 = normalize(vec3(N * slope * KB.x * 0.9, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float spec = pow(max(dot(n3, normalize(vec3(-0.45, -0.75, 0.55) + V)), 0.0), KB.w)
    + 0.45 * pow(max(dot(n3, normalize(vec3(0.45, 0.75, 0.55) + V)), 0.0), KB.w);
  spec *= KB.y;
  float rim = exp(-x / 1.2) * (0.16 + 0.5 * pow(abs(dot(N, vec2(-0.6, -0.8))), 3.0)) * KB.x;
  float cur = 0.0;
  if (uLight.z > 0.0) {
    vec2 dl = p - uLight.xy;
    float att = exp(-dot(dl, dl) / (uLight.w * uLight.w * 1.6)) * uLight.z * uSpec;
    vec3 Lc = normalize(vec3(-dl, uLight.w * 0.35));
    // Kept on the rim, thin and crisp: the cursor never widens the edge.
    cur = (pow(max(dot(n3, normalize(Lc + V)), 0.0), KB.w * 0.8) * 1.1 + exp(-x / 0.8) * 0.3) * att;
  }
  col += uLightCol * (spec + cur) + vec3(rim) + bend * 0.06 * KB.x;
  col += gr * 0.09;
  if (uSheen.x >= 0.0 && depth < 0.5) {
    // Glossy veil: a soft band with a brighter core, gliding across the selected card.
    vec2 q = p - uSheenBox.xy;
    if (abs(q.x) <= uSheenBox.z && abs(q.y) <= uSheenBox.w) {
      vec2 dir = vec2(cos(uSheen.w), sin(uSheen.w));
      float reach = abs(uSheenBox.z * dir.x) + abs(uSheenBox.w * dir.y) + uSheen.z * 2.0;
      float d = (dot(q, dir) - mix(-reach, reach, uSheen.x)) / max(uSheen.z, 1.0);
      float band = exp(-d * d * 1.6) * 0.75 + exp(-d * d * 14.0) * 0.35;
      col += uLightCol * band * uSheen.y * 0.45;
    }
  }
  if (uMatter.y > 0.0) {
    // Depth: the inner wall of the rim shades the inside a little, its inner edge catches light.
    float inner = x - th;
    col *= 1.0 - uMatter.y * 0.3 * (inner > 0.0 ? exp(-inner / 7.0) : 0.0);
    col += uLightCol * uMatter.y * 0.07 * exp(-abs(inner) / 0.9);
  }
  return mix(c0, min(col, vec3(1.0)), cover);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uView / uRes;
  float px = uView.x / uRes.x;
  vec3 col = texture(uTex, gl_FragCoord.xy / uRes).rgb;
  if (uN > 0) {
    col = layer(col, p, 0.0, px);
    if (uNested > 0) col = layer(col, p, 1.0, px);
  }
  outColor = vec4(col, 1.0);
}
`;
