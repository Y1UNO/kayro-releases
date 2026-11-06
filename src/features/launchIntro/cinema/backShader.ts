/**
 * The launch scene's back layer (one full-window pass): a night of moving green ink (domain-warped
 * noise with thin veins, a slow swirl round the card), the circle of runes on the ground under the
 * card and the upright seal behind it, both found by casting each pixel's ray on their plane
 * (a small pinhole camera: the card's plane is the screen, `uP` px away). Lines are measured in
 * world px and smoothed by their screen size (fwidth); glyphs come from an 8-cell atlas.
 */
export const BACK_UNIFORMS = [
  "uView",
  "uScale",
  "uO",
  "uP",
  "uT",
  "uA",
  "uB",
  "uK",
  "uGround",
  "uSeal",
  "uSeal2",
  "uGlyphs",
] as const;

export const NOISE = `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return s;
}
`;

export const BACK_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uView;    // CSS px
uniform float uScale;  // backing px per CSS px
uniform vec2 uO;       // the card's centre (CSS px): the world's origin
uniform float uP;      // focal length (px)
uniform float uT;      // s
uniform vec3 uA;       // the game's colours, 0–1
uniform vec3 uB;
uniform vec4 uK;       // cover, smoke, swirl, fire
uniform vec4 uGround;  // plane height, radius, drawn share, runes share
uniform vec4 uSeal;    // depth, radius, drawn share, runes share
uniform vec4 uSeal2;   // alpha, yaw, spin, star
uniform sampler2D uGlyphs;
out vec4 outColor;
${NOISE}
const float TAU = 6.2831853;

float line(float d, float w, float aa) {
  return 1.0 - smoothstep(w - aa, w + aa, abs(d));
}

// Glyph i of the atlas (4 × 2), at cell coordinates (u across, v up): 0 outside.
float glyph(float i, vec2 c) {
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0) return 0.0;
  float k = mod(i, 8.0);
  vec2 cell = vec2(mod(k, 4.0), floor(k / 4.0));
  return textureLod(uGlyphs, (cell + vec2(c.x, 1.0 - c.y)) / vec2(4.0, 2.0), 0.0).a;
}

// A band of runes between radii a and b, n of them, burnt in one after the other.
vec2 runeBand(float r, float thn, float a, float b, float n, float shown) {
  float k = thn * n;
  float i = floor(k);
  float arc = TAU * r / n;
  vec2 c = vec2((fract(k) - 0.5) * arc / (b - a) + 0.5, (r - a) / (b - a));
  float g = glyph(i, c);
  float x = shown * (n + 2.0) - i;
  float on = smoothstep(0.0, 1.0, x);
  return vec2(g * on, g * on * exp(-max(x, 0.0) * 1.3));
}

vec3 smoke(vec2 s) {
  vec2 q0 = s / uView.y * 2.4;
  float r = length(q0);
  float a = uK.z * 0.9 / (r + 0.45) + uT * 0.05;
  q0 = mat2(cos(a), -sin(a), sin(a), cos(a)) * q0;
  vec2 q = vec2(fbm(q0 + vec2(0.0, uT * 0.07)), fbm(q0 + vec2(5.2, 1.3) - uT * 0.05));
  vec2 w = vec2(fbm(q0 + 3.5 * q + vec2(1.7, 9.2) + uT * 0.08),
                fbm(q0 + 3.5 * q + vec2(8.3, 2.8) - uT * 0.06));
  float f = fbm(q0 + 3.0 * w);
  float veins = pow(0.5 + 0.5 * sin(f * 18.0 + w.x * 8.0), 8.0);
  float body = smoothstep(0.3, 0.8, f);
  vec3 c = uA * (0.11 * body + 0.34 * veins * body) + uB * 0.05 * veins * body;
  // Clearer round the card, thinning at the far edges.
  return c * (0.35 + 0.65 * smoothstep(0.1, 0.7, r));
}

vec3 groundCircle(vec2 s, float aa0) {
  float yg = uGround.x;
  float R = uGround.y;
  float lam = yg / max(s.y, 0.001);
  vec2 g = vec2(lam * s.x, uP * (lam - 1.0));
  float r = length(g);
  float aa = fwidth(r) * 1.1 + aa0;
  float thn = fract(atan(g.y, g.x) / TAU + 0.75);
  float draw = uGround.z;
  float sw1 = step(thn, draw);
  float sw2 = step(1.0 - thn, draw);
  float l = line(r - R, 2.2, aa) * sw1;
  l += line(r - R * 0.86, 1.6, aa) * sw2;
  l += line(r - R * 1.12, 1.0, aa) * sw1 * 0.6;
  l += line(r - R * 0.42, 1.2, aa) * sw2 * 0.7;
  // A crown of ticks, every 6th longer.
  float k = thn * 72.0;
  float d = abs(fract(k + 0.5) - 0.5) * TAU * r / 72.0;
  float longTick = step(abs(mod(floor(k + 0.5), 6.0)), 0.5);
  float inTick = step(R * 1.005, r) * step(r, R * mix(1.05, 1.1, longTick));
  l += (1.0 - smoothstep(0.9 - aa, 0.9 + aa, d)) * inTick * sw1;
  vec2 runes = runeBand(r, thn, R * 0.885, R * 0.975, 24.0, uGround.w);
  // Its glow, the drawing head, the pool of firelight under the card.
  float glow = exp(-abs(r - R) / 16.0) * 0.3 * sw1 + exp(-abs(r - R * 0.86) / 12.0) * 0.22 * sw2;
  float head = exp(-abs(r - R) / 8.0) * exp(-abs(thn - draw) * 90.0) * step(draw, 0.999);
  float pool = exp(-(r * r) / (R * R * 0.4)) * uK.w;
  vec3 ink = mix(uB, vec3(1.0), 0.35);
  vec3 c = ink * (l + runes.x * 0.95 + runes.y * 1.6 + head * 1.4) + uA * (glow + pool * 0.45 + runes.x * 0.25);
  // Nearer is brighter; nothing behind the camera or past the circle's light.
  float near = 1.0 - 0.45 * smoothstep(-R, R * 1.5, g.y);
  float mask = step(0.001, s.y) * (1.0 - smoothstep(R * 1.3, R * 1.6, r));
  return c * near * mask;
}

vec3 seal(vec2 s, float aa0) {
  float yaw = uSeal2.y;
  vec3 n = vec3(sin(yaw), 0.0, -cos(yaw));
  vec3 Q = vec3(0.0, -uSeal.y * 0.05, uSeal.x);
  vec3 C = vec3(0.0, 0.0, -uP);
  vec3 d = vec3(s, uP);
  float lam = dot(Q - C, n) / dot(d, n);
  vec3 X = C + lam * d - Q;
  vec2 sp = vec2(dot(X, vec3(cos(yaw), 0.0, sin(yaw))), -X.y);
  float Rs = uSeal.y;
  float r = length(sp);
  float aa = fwidth(r) * 1.1 + aa0;
  float th = atan(sp.y, sp.x) + uSeal2.z;
  float thn = fract(th / TAU + 0.25);
  float draw = uSeal.z;
  float sw1 = step(thn, draw);
  float sw2 = step(1.0 - thn, draw);
  float l = line(r - Rs, 2.0, aa) * sw1 + line(r - Rs * 0.93, 1.0, aa) * sw2;
  l += line(r - Rs * 0.70, 1.6, aa) * sw2 + line(r - Rs * 0.66, 0.8, aa) * sw1;
  vec2 runes = runeBand(r, thn, Rs * 0.735, Rs * 0.895, 12.0, uSeal.w);
  // An eight-point star {8/3} turning the other way, inside the inner ring.
  float st = 0.0;
  float a0 = -2.0 * uSeal2.z;
  for (int i = 0; i < 8; i++) {
    float ai = a0 + float(i) * TAU / 8.0;
    float aj = a0 + float(i + 3) * TAU / 8.0;
    vec2 p0 = Rs * 0.66 * vec2(cos(ai), sin(ai));
    vec2 p1 = Rs * 0.66 * vec2(cos(aj), sin(aj));
    vec2 e = p1 - p0;
    float h = clamp(dot(sp - p0, e) / dot(e, e), 0.0, 1.0);
    st = max(st, line(length(sp - p0 - e * h), 1.1, aa));
  }
  // A crescent above the seal (it does not turn).
  vec2 cm = sp - vec2(0.0, Rs * 1.14);
  float moon = smoothstep(Rs * 0.115 + aa, Rs * 0.115 - aa, length(cm))
             * smoothstep(Rs * 0.095 - aa, Rs * 0.095 + aa, length(cm - vec2(Rs * 0.05, Rs * 0.03)));
  float glow = exp(-abs(r - Rs) / 14.0) * 0.32 * sw1 + exp(-abs(r - Rs * 0.7) / 12.0) * 0.2 * sw2;
  vec3 ink = mix(uB, vec3(1.0), 0.3);
  vec3 c = ink * (l + st * uSeal2.w * 0.8 + runes.x + runes.y * 1.5 + moon * uSeal.z)
         + uA * (glow + runes.x * 0.3 + st * uSeal2.w * 0.25 + moon * 0.4);
  return c * uSeal2.x * step(0.0, lam) * 0.85;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
  vec2 s = p - uO;
  float aa0 = 0.6 / uScale;
  vec3 night = mix(vec3(0.006, 0.010, 0.010), uA * 0.05, 0.55);
  vec3 c = night + smoke(s) * uK.y;
  c += groundCircle(s, aa0) + seal(s, aa0);
  // A slight dither against banding in the dark.
  c += (hash(gl_FragCoord.xy + uT) - 0.5) / 255.0;
  outColor = vec4(c * uK.x, uK.x);
}
`;
