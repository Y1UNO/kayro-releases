import { APP_NAME } from "../../app/appName";
import { daStore } from "../../design/da";
import { Choreo } from "../../design/motion/choreo";
import { setIntroCue } from "../../fx/gpu/cues";
import { prefersReducedMotion } from "../../fx/motionPref";
import { hubStore } from "../../store";
import {
  letterOffsets,
  openingAt,
  openingDuration,
  openingRestAt,
  openingSettings,
  type OpeningGeometry,
  type Part,
} from "./openingTimeline";

/** Reduced motion: the finished picture stays this long before the home screen (no fade). */
const STILL_MS = 1200;

export const LETTERS = Array.from(APP_NAME);

/** The home screen's ring (centre, radius) from the art direction, for `ringGrow`. */
function homeRing(): OpeningGeometry["homeRing"] {
  const c = daStore.getState().values.crystalRing;
  const n = (k: string, d: number) => (typeof c?.[k] === "number" ? (c[k] as number) : d);
  const size = n("size", 680);
  return { x: innerWidth / 2 + n("offsetX", 0), y: n("top", -230) + size / 2, r: size / 2 };
}

/** Last values written per element: a still element gets no style change (no new layer pass). */
const written = new WeakMap<HTMLElement, { o: string; t: string }>();

function write(el: HTMLElement | null, opacity: string | null, transform: string | null): void {
  if (!el) return;
  let w = written.get(el);
  if (!w) written.set(el, (w = { o: "", t: "" }));
  if (opacity !== null && opacity !== w.o) el.style.opacity = w.o = opacity;
  if (transform !== null && transform !== w.t) el.style.transform = w.t = transform;
}

function place(el: HTMLElement | null, p: Part, o = p.o): void {
  write(
    el,
    o.toFixed(3),
    `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) scale(${p.scale.toFixed(4)})`,
  );
}

/**
 * Runs the opening in the elements of `host` (marked `data-part`, see Opening.tsx) and fades
 * `under` (the home screen) in at the end. Returns the cleanup. `seek`: dev, shows one moment.
 */
export function runOpening(
  host: HTMLElement,
  under: HTMLElement | null,
  seek: number | null,
  onDone: () => void,
): () => void {
  const part = (name: string) => host.querySelector<HTMLElement>(`[data-part="${name}"]`);
  const all = (name: string) => [...host.querySelectorAll<HTMLElement>(`[data-part="${name}"]`)];
  const logo = part("logo");
  const logoBlur = part("logo-blur");
  const sheen = part("sheen");
  const letters = all("letter");
  const blurred = all("letter-blur");
  const line = part("line");
  const sub = part("sub");
  const bg = part("bg");
  const bgLight = part("bg-light");
  const halo = part("halo");
  const ring = part("ring");

  const s = openingSettings(daStore.getState().values.opening);
  const eco = hubStore.getState().settings?.quality === "eco";
  const reduced = prefersReducedMotion();
  const choreo = new Choreo();
  const total = openingDuration(s);
  host.style.setProperty("--opening-blur", `${s.letterBlur}px`);
  host.style.setProperty("--opening-r", `${s.ringRadius}px`);
  if (eco) host.dataset.eco = "";
  const haloBase = 340 * (s.ringRadius / 200);
  const state = {
    geo: {
      logo: { x: innerWidth / 2, y: innerHeight * 0.416 },
      slide: 0,
      letters: LETTERS.map(() => 0),
      homeRing: homeRing(),
    } as OpeningGeometry,
    content: -1,
    home: -1, // last opacity written on the two big layers (no style change while it stays)
    alive: true,
    still: 0,
  };

  const render = (time: number) => {
    const f = openingAt(time, s, state.geo);
    if (f.home !== state.home || f.content !== state.content) {
      state.home = f.home;
      state.content = f.content;
      host.style.opacity = String(f.content);
      if (under) under.style.opacity = String(f.home);
    }
    const lb = eco ? 0 : f.logo.blur;
    place(logo, f.logo, f.logo.o * (1 - lb));
    place(logoBlur, f.logo, f.logo.o * lb);
    write(sheen, null, `translateX(${f.sheen.toFixed(2)}px) skewX(-20deg)`);
    f.letters.forEach((p, i) => {
      const b = eco ? 0 : p.blur;
      place(letters[i] ?? null, p, p.o * (1 - b));
      place(blurred[i] ?? null, p, p.o * b);
    });
    write(line, null, `scaleX(${f.line.toFixed(4)})`);
    place(sub, f.sub);
    // Without the engine: plain shapes (the ring appears instead of being drawn, no glint).
    const fb = document.documentElement.dataset.glassEngine !== undefined ? 0 : 1;
    // Its own background above the CSS atmosphere: dark, then the theme gradient fades in.
    write(bg, String(fb), null);
    write(bgLight, f.intro.fade.toFixed(3), null);
    write(
      halo,
      (fb * f.intro.halo[3]).toFixed(3),
      `scale(${(f.intro.halo[2] / haloBase).toFixed(4)})`,
    );
    write(
      ring,
      (fb * f.intro.ring[3] * f.intro.draw[0]).toFixed(3),
      `scale(${(f.intro.ring[2] / s.ringRadius).toFixed(4)})`,
    );
  };

  const finish = () => {
    choreo.cancel();
    render(total);
    setIntroCue(null);
    onDone();
  };

  /** Logo and letters where the layout puts them (no transform changes a layout box's centre). */
  const measure = (g: OpeningGeometry): OpeningGeometry => {
    const box = logo?.getBoundingClientRect();
    if (!box) return g;
    // render(0) placed the logo with the provisional geometry: no slide yet (g.slide = 0).
    const lx = box.left + box.width / 2 - g.slide;
    const ly = box.top + box.height / 2;
    const centres = LETTERS.map((_, i) => {
      const r = letters[i]?.parentElement?.getBoundingClientRect();
      return r ? r.left + r.width / 2 : lx;
    });
    return {
      logo: { x: lx, y: ly },
      slide: innerWidth / 2 - lx,
      letters: letterOffsets(lx, centres),
      homeRing: homeRing(),
    };
  };

  // From the first frame the engine waits (dark page, no home layers) until the sequence starts.
  setIntroCue((now) => openingAt(choreo.time(now), s, state.geo).intro);
  render(0);

  const skip = (e: Event) => {
    if (seek !== null) return;
    e.preventDefault();
    e.stopPropagation();
    finish();
  };
  window.addEventListener("keydown", skip, true);
  host.addEventListener("pointerdown", skip);

  void document.fonts.ready.then(() => {
    if (!state.alive) return;
    state.geo = measure(state.geo);
    if (seek !== null) return choreo.seek(seek, render);
    if (reduced) {
      choreo.seek(openingRestAt(s), render);
      state.still = window.setTimeout(finish, Math.max(STILL_MS, s.hold));
      return;
    }
    void choreo.play(total, render, { eco }).then((ended) => ended && finish());
  });

  return () => {
    state.alive = false;
    window.clearTimeout(state.still);
    window.removeEventListener("keydown", skip, true);
    host.removeEventListener("pointerdown", skip);
    choreo.cancel();
    setIntroCue(null);
    if (under) under.style.opacity = "";
  };
}
