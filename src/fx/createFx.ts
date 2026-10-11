import type { Quality } from "../design";
import { DustLayer } from "./canvas/dust";
import { CssFxLayer, cls } from "./css/cssFx";
import type { FxLayer, FxPalette, FxParams, FxTarget } from "./FxLayer";
import { MoonLayer } from "./css/moonFx";
import { RingLayer } from "./css/ringFx";
import { ParticlesLayer } from "./canvas/particles";
import { RingGlLayer } from "./gpu/ringGl";
import { frameLoop } from "./loop";

/** Fade before a pause / after a resume (ARCHITECTURE.md §5: « Atténué », 400 ms). */
export const FADE_MS = 400;

export const INTENSITY_MIN = 0.3;
export const INTENSITY_MAX = 1;

export function clampIntensity(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return INTENSITY_MAX;
  return Math.min(INTENSITY_MAX, Math.max(INTENSITY_MIN, v));
}

/**
 * The atmosphere: every layer behind one `FxLayer`, plus the fade and the real stop of `pause`.
 * Layers are stacked in order (CSS fog and light, then the dust canvas). `make` lets a test or a
 * future WebGL engine supply other layers.
 */
export function createFx(
  make: () => FxLayer[] = () => [
    new CssFxLayer(),
    new MoonLayer(),
    new RingLayer(),
    new RingGlLayer(),
    new DustLayer(),
    new ParticlesLayer(),
  ],
): FxLayer {
  const layers = make();
  let host: HTMLDivElement | null = null;
  let fadeTimer = 0;
  let paused = false;
  let quality: Quality = "balanced";
  const motion =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const onMotion = () => fx.setQuality(quality);

  const fx: FxLayer = {
    mount(parent) {
      host = document.createElement("div");
      host.className = cls("host");
      host.setAttribute("aria-hidden", "true");
      parent.appendChild(host);
      for (const l of layers) l.mount(host);
      motion?.addEventListener("change", onMotion);
    },
    setQuality(q) {
      quality = q;
      for (const l of layers) l.setQuality(q);
    },
    setPalette(p: FxPalette) {
      for (const l of layers) l.setPalette(p);
    },
    setIntensity(v) {
      const k = clampIntensity(v);
      for (const l of layers) l.setIntensity(k);
    },
    setFocusTarget(t: FxTarget | null) {
      for (const l of layers) l.setFocusTarget(t);
    },
    setParams(p: FxParams) {
      for (const l of layers) l.setParams(p);
    },
    pause() {
      if (paused || !host) return;
      paused = true;
      host.dataset.fx = "paused"; // opacity → 0 in FADE_MS
      window.clearTimeout(fadeTimer);
      fadeTimer = window.setTimeout(() => {
        for (const l of layers) l.pause();
        frameLoop().pause();
      }, FADE_MS);
    },
    resume() {
      if (!paused || !host) return;
      paused = false;
      window.clearTimeout(fadeTimer);
      frameLoop().resume();
      for (const l of layers) l.resume();
      delete host.dataset.fx; // opacity → 1 in FADE_MS
    },
    dispose() {
      window.clearTimeout(fadeTimer);
      if (paused) frameLoop().resume(); // the loop is shared: never leave it stopped behind us
      paused = false;
      motion?.removeEventListener("change", onMotion);
      for (const l of layers) l.dispose();
      host?.remove();
      host = null;
    },
  };
  return fx;
}
