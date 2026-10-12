import { EASES } from "../../design/da/catalogue";
import type { ElementValues } from "../../design/da/daParams";
import { curveOf, lerp, seg } from "../../design/motion/curve";
import { OPENING_C } from "../../design/motion/tokens4b";
import type { IntroFrame } from "../../fx/gpu/cues";

/**
 * Opening V1-A "the letters come out of the logo" as a pure function of time
 * (reference/animations/R3-Ouverture-V1-A-Lettres-sortent-du-logo.txt, mock-up R3-Ouverture-V1-A).
 * Times in ms at speed 1. The base V1 ("Éclosion de l'anneau") is fixed by the spec; what V1-A
 * changes (logo slide, letters) and the hand-off to the home screen come from the catalogue.
 */

export interface OpeningSettings {
  speed: number;
  slideMs: number;
  slideEase: string;
  letterDelay: number;
  letterMs: number;
  letterEase: string;
  letterScale: number;
  letterBlur: number;
  ringRadius: number;
  ringGrow: boolean;
  hold: number;
  handoff: number;
  /** Round 4b: "c" = variant C's pulse (openingReveal.ts, default), "v1a" = without it. */
  pulse: string;
  veil: number;
  wave: number;
}

export function openingSettings(v: ElementValues | undefined): OpeningSettings {
  const num = (k: string, d: number) => (typeof v?.[k] === "number" ? (v[k] as number) : d);
  const str = (k: string, d: string) => (typeof v?.[k] === "string" ? (v[k] as string) : d);
  return {
    speed: Math.max(0.1, num("speed", 1)),
    slideMs: num("slideMs", 650),
    slideEase: str("slideEase", "premium"),
    letterDelay: num("letterDelay", 85),
    letterMs: num("letterMs", 800),
    letterEase: str("letterEase", "vive"),
    letterScale: num("letterScale", 0.45),
    letterBlur: num("letterBlur", 6),
    ringRadius: num("ringRadius", 200),
    ringGrow: v?.ringGrow === true,
    hold: num("hold", 600),
    handoff: num("handoff", 600),
    pulse: str("pulse", "c"),
    veil: num("veil", OPENING_C.veil),
    wave: num("wave", OPENING_C.wave),
  };
}

/** Where things are, measured once in the page (CSS px). */
export interface OpeningGeometry {
  /** Final centre of the logo (after its slide). */
  logo: { x: number; y: number };
  /** Horizontal start offset of the logo (it starts centred on the window): + = to the right. */
  slide: number;
  /** Start offset of each letter (its centre on the logo's final centre): − = to the left. */
  letters: readonly number[];
  /** The home screen's ring (centre, radius), for `ringGrow`. */
  homeRing: { x: number; y: number; r: number };
}

/** Each letter starts on the logo's final centre (hidden behind it, the logo is above). */
export function letterOffsets(logoX: number, letterCentres: readonly number[]): number[] {
  return letterCentres.map((c) => logoX - c);
}

export interface Part {
  o: number;
  x: number;
  y: number;
  scale: number;
  /** Share of the blurred copy (0 = sharp): blur is a cross-fade, never an animated filter. */
  blur: number;
}

export interface OpeningFrame {
  intro: IntroFrame;
  logo: Part;
  /** Glint across the logo: translateX (px). */
  sheen: number;
  letters: Part[];
  /** Line under the name: scaleX. */
  line: number;
  sub: Part;
  /** The whole opening layer (fades out in the hand-off) and the home screen (fades in). */
  content: number;
  home: number;
}

const EASE = curveOf("ease");
const IN_OUT = curveOf("ease-in-out");
const C_DRAW = curveOf("cubic-bezier(.65,0,.35,1)");
const C_PREMIUM = curveOf("cubic-bezier(.22,1,.36,1)");
const C_GLINT = curveOf("cubic-bezier(.45,0,.25,1)");
const C_OUT = curveOf("cubic-bezier(.4,0,.2,1)");
const ease = (name: string) => curveOf(EASES[name] ?? EASES.premium!);

/** End of the base animation (subtitle, letters and slide included), at speed 1. */
function baseEnd(s: OpeningSettings): number {
  return Math.max(3400, 1750 + s.slideMs, 2000 + 4 * s.letterDelay + s.letterMs);
}

/** Time (ms) at which the logo and the name are complete. */
export function openingRestAt(s: OpeningSettings): number {
  return baseEnd(s) / s.speed;
}

/** Whole sequence: animation, hold, hand-off to the home screen. */
export function openingDuration(s: OpeningSettings): number {
  return openingRestAt(s) + s.hold + s.handoff;
}

/** The ring's pulse after its drawing ("ringOut", 1 750 ms, 850 ms): 0 → 1. */
export function ringOutAt(time: number, s: OpeningSettings): number {
  return seg(time * s.speed, 1750, 850, C_OUT);
}

/** Opacity of a CSS keyframe list 0 % → `at` → 100 % (0, 1, 1), the curve applied per interval. */
function keyIn(u: number, at: number, c: (x: number) => number): number {
  return u <= 0 ? 0 : u >= at ? 1 : c(u / at);
}

export function openingAt(
  time: number,
  s: OpeningSettings,
  g: OpeningGeometry,
  letterCount = g.letters.length,
): OpeningFrame {
  const t = time * s.speed; // spec time
  // Hand-off, staggered so that the name and the home screen never sit on top of each other:
  // the opening fades out over the first 55 %, the home screen comes in over the last 70 %.
  const since = time - openingRestAt(s) - s.hold;
  const hu = s.handoff > 0 ? Math.min(1, Math.max(0, since / s.handoff)) : since >= 0 ? 1 : 0;
  const h = IN_OUT((hu - 0.3) / 0.7);
  const gone = IN_OUT(hu / 0.55);

  const fade = seg(t, 0, 700, EASE);
  const haloK = seg(t, 100, 1400, C_PREMIUM);
  const draw = seg(t, 200, 1100, C_DRAW);
  const glintU = (t - 950) / 1050;
  const glintTurn = seg(t, 950, 1050, C_GLINT);
  const glintO =
    glintU <= 0 || glintU >= 1
      ? 0
      : glintU < 0.2
        ? C_GLINT(glintU / 0.2)
        : glintU < 0.8
          ? 1
          : 1 - C_GLINT((glintU - 0.8) / 0.2);
  const out = ringOutAt(time, s);

  const startX = g.logo.x + g.slide;
  const r0 = s.ringRadius;
  let ring: [number, number, number, number];
  let scale: number;
  if (s.ringGrow) {
    scale = lerp(1, g.homeRing.r / r0, out);
    ring = [lerp(startX, g.homeRing.x, out), lerp(g.logo.y, g.homeRing.y, out), r0 * scale, 1 - h];
  } else {
    scale = 1 + 0.4 * out;
    ring = [startX, g.logo.y, r0 * scale, 1 - out];
  }
  const haloR = 340 * (r0 / 200) * (0.75 + 0.25 * haloK);
  const intro: IntroFrame = {
    fade,
    home: h,
    embers: Math.max(seg(t, 2500, 1000, EASE), h),
    halo: [startX, g.logo.y, haloR, haloK * (1 - gone)],
    ring,
    draw: [draw, glintTurn * 2 * Math.PI, glintO, scale],
  };

  const logoK = seg(t, 950, 800, C_PREMIUM);
  const slideK = seg(t, 1750, s.slideMs, ease(s.slideEase));
  const logo: Part = {
    o: logoK,
    x: g.slide * (1 - slideK),
    y: 0,
    scale: 0.86 + 0.14 * logoK,
    blur: 1 - logoK,
  };

  const lc = ease(s.letterEase);
  const letters: Part[] = [];
  for (let i = 0; i < letterCount; i++) {
    const start = 2000 + i * s.letterDelay;
    const u = s.letterMs > 0 ? (t - start) / s.letterMs : t >= start ? 1 : 0;
    const e = lc(u);
    letters.push({
      o: keyIn(u, 0.3, lc),
      x: (g.letters[i] ?? 0) * (1 - e),
      y: 0,
      scale: s.letterScale + (1 - s.letterScale) * e,
      blur: s.letterBlur > 0 ? 1 - e : 0,
    });
  }
  const subK = seg(t, 2800, 600, EASE);
  return {
    intro,
    logo,
    sheen: lerp(-170, 210, seg(t, 1450, 900, IN_OUT)),
    letters,
    line: seg(t, 2550, 700, C_DRAW),
    sub: { o: subK, x: 0, y: 8 * (1 - subK), scale: 1, blur: 0 },
    content: 1 - gone,
    home: h,
  };
}
