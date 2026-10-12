import type { Quality } from "../design";
import { DustLayer } from "./canvas/dust";
import { CssFxLayer, cls } from "./css/cssFx";
import type { FxLayer, FxPalette, FxParams, FxTarget } from "./FxLayer";
import { MoonLayer } from "./css/moonFx";
import { RingLayer } from "./css/ringFx";
import { ParticlesLayer } from "./canvas/particles";
import { GlassEngine, type EngineState } from "./gpu/engine";
import { frameLoop } from "./loop";
import { onReducedMotionChange } from "./motionPref";

/** Fade before a pause / after a resume (ARCHITECTURE.md §5: « Atténué », 400 ms). */
export const FADE_MS = 400;

export const INTENSITY_MIN = 0.3;
/** « Forte » (round 5); « Normale » = 1, the validated look. */
export const INTENSITY_MAX = 1.3;

export function clampIntensity(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 1;
  return Math.min(INTENSITY_MAX, Math.max(INTENSITY_MIN, v));
}

/** Layers the glass engine draws itself while it runs (they are hidden and paused meanwhile). */
function replacedBy(engine: EngineState, l: FxLayer): boolean {
  if (!engine.active) return false;
  if (l instanceof RingLayer) return engine.ring;
  return (
    l instanceof MoonLayer ||
    l instanceof ParticlesLayer ||
    l instanceof CssFxLayer ||
    l instanceof DustLayer
  );
}

/**
 * The atmosphere: every layer behind one `FxLayer`, plus the fade and the real stop of `pause`.
 * Layers are stacked in order (CSS fog and light, then the dust canvas); the glass engine puts its
 * canvas under them and, while it runs, the layers it replaces are paused. `make` lets a test or
 * the dev bench supply other layers.
 */
export function createFx(
  make: (onEngine: (s: EngineState) => void) => FxLayer[] = (onEngine) => [
    new CssFxLayer(),
    new MoonLayer(),
    new RingLayer(),
    new DustLayer(),
    new ParticlesLayer(),
    new GlassEngine(onEngine),
  ],
): FxLayer {
  let engine: EngineState = { active: false, ring: false };
  const onEngine = (s: EngineState) => {
    const before = engine;
    engine = s;
    for (const l of layers) {
      const was = replacedBy(before, l);
      const now = replacedBy(s, l);
      if (now && !was) l.pause();
      else if (was && !now && !paused) l.resume();
    }
  };
  const layers = make(onEngine);
  let host: HTMLDivElement | null = null;
  let fadeTimer = 0;
  let paused = false;
  let quality: Quality = "balanced";
  let offMotion: (() => void) | null = null;
  const onMotion = () => fx.setQuality(quality);

  const fx: FxLayer = {
    mount(parent) {
      host = document.createElement("div");
      host.className = cls("host");
      host.setAttribute("aria-hidden", "true");
      parent.appendChild(host);
      for (const l of layers) l.mount(host);
      offMotion = onReducedMotionChange(onMotion);
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
      for (const l of layers) if (!replacedBy(engine, l)) l.resume();
      delete host.dataset.fx; // opacity → 1 in FADE_MS
    },
    dispose() {
      window.clearTimeout(fadeTimer);
      if (paused) frameLoop().resume(); // the loop is shared: never leave it stopped behind us
      paused = false;
      offMotion?.();
      offMotion = null;
      for (const l of layers) l.dispose();
      host?.remove();
      host = null;
    },
  };
  return fx;
}
