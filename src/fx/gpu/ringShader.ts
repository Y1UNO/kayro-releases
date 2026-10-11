// Shaders of the WebGL2 crystal ring (step 12b spike). One full-quad pass over the ring's box:
// outside the band only the soft glow is drawn (premultiplied alpha, the CSS layers show
// through); inside the band, the lights behind the ring (background gradient, moon, two veils)
// are evaluated again at displaced positions: real refraction of a glass tube, chromatic
// dispersion (one offset per channel), Fresnel rim, a specular highlight towards the pointer
// and the slow rotating reflection. Coordinates are CSS pixels of the viewport, y down.

export const VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;      // canvas size (device px)
uniform vec2 uOrigin;   // canvas top-left (viewport CSS px)
uniform float uPx;      // CSS px per device px of the canvas
uniform vec2 uView;     // viewport size (CSS px)
uniform vec4 uRing;     // centre x, y, outer radius, band width
uniform vec3 uBg0;
uniform vec3 uBg1;
uniform vec3 uBg2;
uniform float uRadial;  // 1 = radial background (V4), 0 = linear (sketch)
uniform vec3 uA;
uniform vec3 uB;
uniform vec4 uMoon;     // centre x, y, radius, intensity
uniform vec4 uVeilA;    // centre x, y, radius x, radius y
uniform vec4 uVeilB;
uniform vec4 uVeil;     // rotation A, rotation B (rad), intensity A, intensity B
uniform vec4 uP;        // refraction, dispersion, frost, specular
uniform vec4 uE;        // edge, fringe, glow, reflection angle (rad)
uniform vec2 uMouse;    // pointer (viewport CSS px)

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
  float a = t < 0.55 ? mix(i, 0.35 * i, t / 0.55) : mix(0.35 * i, 0.0, (t - 0.55) / 0.45);
  return t < 1.0 ? a : 0.0;
}

float veil(vec2 p, vec4 v, float rot) {
  vec2 d = p - v.xy;
  float c = cos(rot), s = sin(rot);
  d = mat2(c, -s, s, c) * d;
  return clamp(1.0 - length(d / v.zw), 0.0, 1.0);
}

vec3 scene(vec2 p) {
  vec3 c = base(p);
  c = mix(c, uA, moon(p));
  c = mix(c, uA, veil(p, uVeilA, uVeil.x) * uVeil.z);
  c = mix(c, uB, veil(p, uVeilB, uVeil.y) * uVeil.w);
  return c;
}

void main() {
  vec2 p = uOrigin + vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uPx;
  vec2 d = p - uRing.xy;
  float r = length(d);
  vec2 n2 = d / max(r, 0.001);
  float R = uRing.z;
  float hw = uRing.w * 0.5;
  float s = (r - (R - hw)) / hw;                 // -1 inner edge … 1 outer edge
  float aa = uPx / hw;
  float inside = smoothstep(-1.0 - aa, -1.0, s) * (1.0 - smoothstep(1.0, 1.0 + aa, s));

  float glowOut = r > R ? exp(-(r - R) / 10.0) : 0.0;
  float glowIn = r < R - 2.0 * hw ? exp(-((R - 2.0 * hw) - r) / 9.0) * 0.55 : 0.0;
  float g = (glowOut + glowIn) * uE.z;
  vec3 col = uA * g;
  float alpha = g;

  if (inside > 0.0) {
    float sc = clamp(s, -1.0, 1.0);
    float h = sqrt(max(1.0 - sc * sc, 0.0));
    vec2 off = -n2 * sc * uP.x * hw * 3.0;       // a lens: the edges look further away
    float disp = uP.y * 0.35;
    vec3 refr = vec3(
      scene(p + off * (1.0 + disp)).r,
      scene(p + off).g,
      scene(p + off * (1.0 - disp)).b
    );
    if (uP.z > 0.0) {
      float t = uP.z * 6.0;
      refr = (refr + scene(p + off + vec2(t, 0.0)) + scene(p + off - vec2(t, 0.0))
        + scene(p + off + vec2(0.0, t)) + scene(p + off - vec2(0.0, t))) / 5.0;
    }
    refr = refr * 1.12 + 0.03;                    // the glass body is slightly brighter
    float fres = pow(abs(sc), 4.0) * uE.x;
    vec3 n3 = normalize(vec3(n2 * sc, h * 0.9 + 0.1));
    vec3 L = normalize(vec3((uMouse - uRing.xy) / R * 0.8, 1.0));
    float spec = pow(max(dot(reflect(-L, n3), vec3(0.0, 0.0, 1.0)), 0.0), 60.0) * uP.w;
    float da = abs(mod(atan(d.y, d.x) - uE.w + 3.14159265, 6.2831853) - 3.14159265);
    float turn = exp(-da * da * 18.0) * h * uP.w * 0.8;
    float fa = exp(-pow((s - 1.0) * hw / 1.2, 2.0)) * uE.y;
    float fb = exp(-pow((s + 1.0) * hw / 1.2, 2.0)) * uE.y;
    vec3 c = refr + vec3(fres + spec + turn) + uA * fa * 1.1 + uB * fb * 0.9;
    col = mix(col, min(c, vec3(1.0)), inside);
    alpha = mix(alpha, 1.0, inside);
  }
  if (alpha < 0.002) discard;
  outColor = vec4(col, min(alpha, 1.0));
}
`;
