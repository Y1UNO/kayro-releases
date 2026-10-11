// Crystal ring of the glass engine: a glass tube drawn into the background texture (pass 1b),
// so that it refracts the real background — particles, bokeh and light bands included — and the
// glass cards in front refract it in turn. One quad over the ring's box, premultiplied output
// blended over a copy of the background. Coordinates: CSS pixels of the viewport, y down.

export const RING_UNIFORMS = [
  "uRes",
  "uView",
  "uBox",
  "uTex",
  "uRing",
  "uA",
  "uB",
  "uP",
  "uE",
  "uLight",
  "uSpec",
] as const;

export const RING_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
uniform vec2 uView;
uniform vec4 uBox;      // x0, y0, x1, y1 (CSS px)
void main() {
  vec2 p = mix(uBox.xy, uBox.zw, aPos * 0.5 + 0.5);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}
`;

export const RING_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;
uniform vec2 uView;
uniform sampler2D uTex; // background (no ring)
uniform vec4 uRing;     // centre x, y, outer radius, band width
uniform vec3 uA;
uniform vec3 uB;
uniform vec4 uP;        // refraction, dispersion, frost, specular
uniform vec4 uE;        // edge, fringe, glow, reflection angle (rad)
uniform vec4 uLight;    // cursor x, y, intensity, radius
uniform float uSpec;    // cursor light on glass

vec3 bg(vec2 p) {
  return texture(uTex, vec2(p.x / uView.x, 1.0 - p.y / uView.y)).rgb;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uView / uRes;
  float px = uView.x / uRes.x;
  vec2 d = p - uRing.xy;
  float r = length(d);
  vec2 n2 = d / max(r, 0.001);
  float R = uRing.z;
  float hw = uRing.w * 0.5;
  float s = (r - (R - hw)) / hw;                 // -1 inner edge … 1 outer edge
  float aa = px / hw;
  float inside = smoothstep(-1.0 - aa, -1.0, s) * (1.0 - smoothstep(1.0, 1.0 + aa, s));

  float glowOut = r > R ? exp(-(r - R) / 12.0) : 0.0;
  float glowIn = r < R - 2.0 * hw ? exp(-((R - 2.0 * hw) - r) / 10.0) * 0.55 : 0.0;
  float g = (glowOut + glowIn) * uE.z;
  vec3 col = uA * g;
  float alpha = g;

  if (inside > 0.0) {
    float sc = clamp(s, -1.0, 1.0);
    float h = sqrt(max(1.0 - sc * sc, 0.0));
    // A round tube: like a lens, the edges show what lies further away.
    vec2 off = -n2 * sc * uP.x * hw * 2.4;
    float disp = uP.y * 0.4 * abs(sc);
    vec3 refr = vec3(bg(p + off * (1.0 + disp)).r, bg(p + off).g, bg(p + off * (1.0 - disp)).b);
    if (uP.z > 0.0) {
      float t = uP.z * 6.0;
      refr = (refr * 2.0 + bg(p + off + vec2(t, 0.0)) + bg(p + off - vec2(t, 0.0))
        + bg(p + off + vec2(0.0, t)) + bg(p + off - vec2(0.0, t))) / 6.0;
    }
    refr = refr * 1.1 + 0.025;                    // the glass body is slightly brighter
    vec3 n3 = normalize(vec3(n2 * sc, h * 0.9 + 0.1));
    float fres = pow(abs(sc), 5.0) * uE.x;
    vec3 Lk = normalize(vec3(-0.45, -0.75, 0.55));
    float spec = pow(max(dot(n3, normalize(Lk + vec3(0.0, 0.0, 1.0))), 0.0), 80.0) * uP.w;
    float cur = 0.0;
    if (uLight.z > 0.0) {
      vec3 Lc = normalize(vec3(uLight.xy - p, uLight.w * 0.35));
      float att = exp(-dot(p - uLight.xy, p - uLight.xy) / (uLight.w * uLight.w * 1.6));
      cur = pow(max(dot(n3, normalize(Lc + vec3(0.0, 0.0, 1.0))), 0.0), 50.0) * att * uLight.z * uSpec;
    }
    float da = abs(mod(atan(d.y, d.x) - uE.w + 3.14159265, 6.2831853) - 3.14159265);
    float turn = exp(-da * da * 18.0) * h * uP.w * 0.6;
    float fa = exp(-pow((s - 1.0) * hw / 1.6, 2.0)) * uE.y;
    float fb = exp(-pow((s + 1.0) * hw / 1.6, 2.0)) * uE.y;
    vec3 c = refr + vec3(fres + spec + turn + cur) + uA * fa * 1.1 + uB * fb * 0.9;
    col = mix(col, min(c, vec3(1.0)), inside);
    alpha = mix(alpha, 1.0, inside);
  }
  if (alpha < 0.002) discard;
  outColor = vec4(col, min(alpha, 1.0));
}
`;
