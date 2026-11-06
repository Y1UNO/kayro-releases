/**
 * Steps 16–17, the special card's layers (specialArt.ts). Dosages, then the program that draws one
 * picture: its shadows tinted by the palette, a rim of light on the edge facing the light
 * (alpha gradient over 8 taps, as in reference/ambiances/hades-II), its foot and outer edge
 * fading into the mist. Premultiplied pictures, premultiplied output.
 */
export const SPECIAL = {
  /** Height of a character × the window's height; its foot at `foot` × the height (cut below). */
  height: 0.86,
  foot: 1.04,
  /** Inner edge of a character, from the shown card's centre, × the window's width. */
  gap: 0.17,
  /** Share of the picture fading at the foot, and at the outer edge. */
  footFade: 0.3,
  sideFade: 0.16,
  /** Shadows tinted towards colour A; rim light (B lightened); overall darkness (night). */
  tint: 0.5,
  rim: 0.85,
  dark: 0.8,
  rimPx: 3,
  /** Slow breathing period (s), fade in / out (ms). */
  breathS: 4.8,
  fadeMs: 600,
  /** Logo: under the shown card, above `logoFloor` × the height, at most this tall / wide. */
  logoFloor: 0.84,
  logoMaxH: 150,
  logoMaxW: 0.28,
  /** Share of the room under the card the logo may take. */
  logoRoom: 0.9,
  logoAlpha: 0.92,
} as const;

export const ART_SHADER = {
  uniforms: ["uRect", "uView", "uTex", "uTint", "uRim", "uK", "uFade", "uRimR", "uLight"],
  vertex: `#version 300 es
layout(location = 0) in vec2 aPos;
uniform vec4 uRect; // x, y, w, h (CSS px)
uniform vec2 uView;
out vec2 vUv;
void main() {
  vec2 u = aPos * 0.5 + 0.5;
  vUv = vec2(u.x, 1.0 - u.y);
  vec2 px = uRect.xy + vUv * uRect.zw;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}
`,
  fragment: `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec3 uTint;
uniform vec3 uRim;
uniform vec4 uK;    // opacity, tint of the shadows, rim strength, darkness (1 = as is)
uniform vec4 uFade; // foot share, outer side (-1 left, 1 right, 0 none), side share, unused
uniform vec2 uRimR; // rim width in uv
uniform vec2 uLight; // where the light comes from (uv, y down)
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUv);
  float a = c.a;
  if (a < 0.003) discard;
  vec3 rgb = c.rgb / a;
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
  rgb = mix(rgb, uTint * (0.3 + lum), (1.0 - smoothstep(0.05, 0.7, lum)) * uK.y);
  rgb *= uK.w;
  if (uK.z > 0.0) {
    float mn = 1.0;
    vec2 g = vec2(0.0);
    for (int i = 0; i < 8; i++) {
      float an = float(i) * 0.785398;
      vec2 d = vec2(cos(an), sin(an));
      float s = texture(uTex, vUv + d * uRimR).a;
      mn = min(mn, s);
      g += d * s;
    }
    vec2 n = -g / max(length(g), 1e-4);
    float band = a * (1.0 - smoothstep(0.3, 0.7, mn));
    float face = smoothstep(-0.2, 0.8, dot(n, normalize(uLight)));
    rgb = mix(rgb, uRim, clamp(band * face * uK.z, 0.0, 1.0));
  }
  float f = 1.0 - smoothstep(1.0 - max(uFade.x, 1e-3), 1.0, vUv.y);
  if (uFade.y < -0.5) f *= smoothstep(0.0, uFade.z, vUv.x);
  if (uFade.y > 0.5) f *= smoothstep(0.0, uFade.z, 1.0 - vUv.x);
  a *= f * uK.x;
  outColor = vec4(rgb * a, a);
}
`,
} as const;
