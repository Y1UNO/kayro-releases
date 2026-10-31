import type { Palette, Shape } from "./islandShape";

/**
 * Step 20 (Kysland): writes a frame of the island to its element (size, corners, shoulders,
 * colours, transform, the panel's content). Style writes only: no React render per frame.
 */
export function paintIsland(
  el: HTMLElement,
  s: Shape,
  colours: Palette,
  hover: number,
  glitch: number,
): void {
  const st = el.style;
  st.width = `${s.width.toFixed(2)}px`;
  st.height = `${s.height.toFixed(2)}px`;
  st.borderRadius = s.radii.map((r) => `${Math.max(0, r).toFixed(2)}px`).join(" ");
  st.setProperty("--sh-tl", s.shoulders.topLeft.toFixed(3));
  st.setProperty("--sh-tr", s.shoulders.topRight.toFixed(3));
  st.setProperty("--sh-sl", s.shoulders.sideLeft.toFixed(3));
  st.setProperty("--sh-sr", s.shoulders.sideRight.toFixed(3));
  st.setProperty("--rim", s.rim.toFixed(3));
  st.setProperty("--hover", hover.toFixed(3));
  st.setProperty("--glitch", glitch.toFixed(3));
  st.setProperty("--content", s.content.toFixed(3));
  st.setProperty("--rest-music", s.rest.music.toFixed(3));
  st.setProperty("--rest-stretch", s.rest.stretch.toFixed(3));
  st.setProperty("--rest-dots", s.rest.dots.toFixed(3));
  st.setProperty("--band", `${s.band.toFixed(2)}px`);
  st.setProperty("--tone", colours.tone.join(" "));
  st.setProperty("--rim-a", colours.rimAlpha.toFixed(3));
  st.setProperty("--glow-a", colours.glowAlpha.toFixed(3));
  st.opacity = s.opacity.toFixed(3);
  st.transformOrigin = `50% ${(s.originY * 100).toFixed(1)}%`;
  st.transform =
    `translate(calc(-50% + ${s.x.toFixed(2)}px), ${s.y.toFixed(2)}px) ` +
    `rotate(${s.rotate.toFixed(2)}deg) skewX(${s.skew.toFixed(2)}deg) ` +
    `scale(${s.scaleX.toFixed(4)}, ${s.scaleY.toFixed(4)})`;
}
