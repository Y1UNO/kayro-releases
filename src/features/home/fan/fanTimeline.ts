/**
 * Category link A "the fan turns, then the deck unfolds" (art direction round 3b; spec
 * reference/animations/R3-Categories-Liaison-A-Eventail-pivote.txt, mock-up R3-Liaison-A.dc.html).
 *
 * The mock-up moves its elements with CSS transitions between five phases. This module replays
 * that model as a pure function of time, so a sequence can be seeked, tested, and drawn by the
 * glass engine at the same moment as the DOM:
 *
 * - The scene is a set of numeric tracks (rotation of a category card, x of an app slot, opacity
 *   of the title…). A phase gives each track a target with its own delay, duration and curve.
 * - A sequence is a list of steps (time, phase). At each step every track starts a "transition"
 *   from its current value, exactly like CSS does when a target changes mid-way. So a sequence
 *   started while another one is under way leaves from where the elements are: no jump.
 */
import { EASES } from "../../../design/da/catalogue";
import type { ElementValues } from "../../../design/da/daParams";
import { springAt, SPRINGS } from "../../../design/glass/pillMotion";
import { curveOf, lerp, type Curve } from "../../../design/motion/curve";
import { MOTION_DEFAULTS as M } from "../../../design/motion/tokens";
import { DANCE, danceOverlay, danceSpan } from "./fanDance";

export type Phase = "choose" | "turn" | "deck" | "dance" | "spread" | "close";
export const FAN_SIZE = 5;
/** Mock-up values (fixed by the spec). */
export const CARD = { w: 210, h: 290, r: 24 } as const;
const LIFT = { y: -30, s: 1.06 };
const DOCKED = { y: -14, s: 0.6 };
const DECK = { dx: 7, dy: 4, y0: -10, rot: 3.5, s: 0.55 };
const RING_AWAY = { y: 140, s: 0.9 };
const BACK_STAGGER = 35;

const EASE_CSS = curveOf("ease");
const SOFT = curveOf("cubic-bezier(.4,0,.2,1)");
const CARD_EASE = curveOf("cubic-bezier(.22,1,.36,1)");
/**
 * Titles of the link (round 5): the leaving title goes first (0.7 × « court », the leaving curve,
 * −20 px up or +14 px down), the arriving one comes 120 ms later (« moyen », the entrance curve,
 * from those offsets): never both readable at once. The same both ways (link and back).
 */
const TITLE = {
  out: M.court * M.outShare,
  outEase: curveOf(EASES[M.easeOut]!),
  in: M.moyen,
  inEase: curveOf(EASES[M.easeIn]!),
  inAfter: 120,
  askAway: -20,
  catAway: 14,
} as const;

export interface LinkConfig {
  speed: number;
  angle: number;
  pivot: number;
  exitAngle: number;
  turnMs: number;
  turn: Curve;
  blur: number;
  unfoldMs: number;
  spring: Curve;
  stagger: number;
  regroup: number;
  /** One card's dance at a tab change (ms, fanDance.ts); 0 = the plain gather and unfold. */
  danceMs: number;
}

const n = (v: ElementValues | undefined, k: string, d: number) =>
  typeof v?.[k] === "number" ? (v[k] as number) : d;

/**
 * Settings of the `categoryLink` element (defaults = the spec). Eco: no blur. `crisp` (« Mouvement :
 * Net », review A5): the deck unfolds on the entrance curve, no spring.
 */
export function linkConfig(v: ElementValues | undefined, eco = false, crisp = false): LinkConfig {
  const bounce = SPRINGS[String(v?.spring ?? "liaison")] ?? SPRINGS.liaison!;
  const entrance = curveOf(EASES.vive!);
  return {
    speed: Math.max(0.1, n(v, "speed", 1)),
    angle: n(v, "angle", 7),
    pivot: n(v, "pivot", 1300),
    exitAngle: n(v, "exitAngle", 15),
    turnMs: n(v, "turnMs", 850),
    turn: curveOf(EASES[String(v?.turnEase ?? "bascule")] ?? EASES.bascule!),
    blur: eco ? 0 : n(v, "blur", 6),
    unfoldMs: n(v, "unfoldMs", 700),
    spring: crisp ? entrance : (t) => springAt(t, bounce),
    stagger: n(v, "stagger", 70),
    regroup: n(v, "regroup", 380),
    danceMs: Math.max(0, n(v, "danceMs", 1250)),
  };
}

/** What the phases depend on: the chosen category, the deck order, the app slots on screen. */
export interface LinkContext {
  /** Chosen category (0–4, rank in the fan). */
  cat: number;
  /** Shuffle count: the deck order changes at each tab change. */
  shuf: number;
  /** Visible app slots: k = d + 2 (d = distance to the selected app), with their carousel pose. */
  slots: readonly { k: number; x: number; s: number }[];
}

interface Target {
  to: number;
  delay: number;
  dur: number;
  ease: Curve;
}
type Targets = Map<string, Target>;

const tg = (to: number, dur: number, ease: Curve, delay = 0): Target => ({ to, delay, dur, ease });

/** Deck pose of app slot k (stacking order changes with the shuffle count). */
export function deckOrder(k: number, shuf: number): number {
  return (((k * 3 + shuf * 2) % FAN_SIZE) + FAN_SIZE) % FAN_SIZE;
}

/** Targets of every track in `phase` (the mock-up's renderVals, as numbers). */
export function phaseTargets(phase: Phase, ctx: LinkContext, c: LinkConfig): Targets {
  const m = new Map<string, Target>();
  const choose = phase === "choose";
  const inside = phase !== "choose" && phase !== "turn" && phase !== "close";
  for (let i = 0; i < FAN_SIZE; i++) {
    const sel = i === ctx.cat;
    const d = i - 2;
    if (choose) {
      m.set(`c${i}.rot`, tg(d * c.angle, c.turnMs, c.turn));
      m.set(`c${i}.o`, tg(1, 500, EASE_CSS, Math.abs(i - ctx.cat) * BACK_STAGGER));
      m.set(`c${i}.blur`, tg(0, 500, EASE_CSS, Math.abs(i - ctx.cat) * BACK_STAGGER));
      m.set(`c${i}.ty`, tg(0, 600, CARD_EASE));
      m.set(`c${i}.sc`, tg(1, 600, CARD_EASE));
      m.set(`c${i}.io`, tg(1, 400, EASE_CSS));
    } else if (!sel) {
      m.set(`c${i}.rot`, tg((i - ctx.cat) * c.exitAngle, c.turnMs, c.turn));
      m.set(`c${i}.o`, tg(0, 500, EASE_CSS, 120));
      m.set(`c${i}.blur`, tg(c.blur, 500, EASE_CSS, 120));
      m.set(`c${i}.ty`, tg(0, 600, CARD_EASE));
      m.set(`c${i}.sc`, tg(1, 600, CARD_EASE));
      m.set(`c${i}.io`, tg(1, 400, EASE_CSS));
    } else {
      const lifted = phase === "turn" || phase === "close";
      m.set(`c${i}.rot`, tg(0, c.turnMs, c.turn));
      m.set(`c${i}.o`, tg(1, 500, EASE_CSS));
      m.set(`c${i}.blur`, tg(0, 500, EASE_CSS));
      m.set(`c${i}.ty`, tg(lifted ? LIFT.y : DOCKED.y, 600, CARD_EASE));
      m.set(`c${i}.sc`, tg(lifted ? LIFT.s : DOCKED.s, 600, CARD_EASE));
      m.set(`c${i}.io`, tg(lifted ? 1 : 0, 400, EASE_CSS));
    }
  }
  for (const { k, x, s } of ctx.slots) {
    const ad = Math.abs(k - 2);
    if (phase === "spread") {
      const delay = ad * c.stagger;
      m.set(`a${k}.x`, tg(x, c.unfoldMs, c.spring, delay));
      m.set(`a${k}.y`, tg(0, c.unfoldMs, c.spring, delay));
      m.set(`a${k}.rot`, tg(0, c.unfoldMs, c.spring, delay));
      m.set(`a${k}.sc`, tg(s, c.unfoldMs, c.spring, delay));
      m.set(`a${k}.o`, tg(1, 450, EASE_CSS, delay));
      // Faces (letter, name) of the cards under the top one come back as they leave the deck.
      m.set(`a${k}.f`, tg(1, 250, EASE_CSS, delay + c.unfoldMs * 0.2));
    } else if (phase === "dance") {
      // The carousel places: the dance (fanDance.ts) is laid over them, leaving and coming back.
      for (const [key, to] of [
        ["x", x],
        ["y", 0],
        ["rot", 0],
        ["sc", s],
        ["o", 1],
        ["f", 1],
      ] as const)
        m.set(`a${k}.${key}`, tg(to, 500, SOFT));
      m.set(`a${k}.z`, tg(-ad, 0, EASE_CSS));
    } else {
      const off = deckOrder(k, ctx.shuf) - 2;
      const delay = phase === "deck" ? (2 - ad) * BACK_STAGGER : 0;
      m.set(`a${k}.x`, tg(off * DECK.dx, 700, SOFT, delay));
      m.set(`a${k}.y`, tg(Math.abs(off) * DECK.dy + DECK.y0, 700, SOFT, delay));
      m.set(`a${k}.rot`, tg(off * DECK.rot, 700, SOFT, delay));
      m.set(`a${k}.sc`, tg(DECK.s, 700, SOFT, delay));
      m.set(`a${k}.o`, tg(phase === "deck" ? 1 : 0, 450, SOFT, delay));
      // A deck shows the face of its top card only (the DOM text sits above the engine's glass).
      m.set(`a${k}.f`, tg(off === 2 ? 1 : 0, 200, EASE_CSS));
      m.set(`a${k}.z`, tg(off + 2, 0, EASE_CSS));
    }
  }
  const leave = (to: number) => tg(to, TITLE.out, TITLE.outEase);
  const come = (to: number) => tg(to, TITLE.in, TITLE.inEase, TITLE.inAfter);
  m.set("ask.o", choose ? come(1) : leave(0));
  m.set("ask.y", choose ? come(0) : leave(TITLE.askAway));
  m.set("cat.o", choose ? leave(0) : come(1));
  m.set("cat.y", choose ? leave(TITLE.catAway) : come(0));
  m.set("back.o", tg(choose ? 0 : 1, 450, EASE_CSS));
  m.set("tabs.o", tg(inside ? 1 : 0, 450, EASE_CSS));
  m.set("body.o", tg(inside ? 1 : 0, 450, EASE_CSS));
  m.set("ring.y", tg(inside ? 0 : RING_AWAY.y, 900, CARD_EASE));
  m.set("ring.s", tg(inside ? 1 : RING_AWAY.s, 900, CARD_EASE));
  m.set("ring.o", tg(inside ? 1 : 0, 600, EASE_CSS));
  return m;
}

/** Values of every track, by key. */
export type Values = Map<string, number>;

/** The phase a scene rests in (no motion): the values its targets reach. */
export function restValues(phase: Phase, ctx: LinkContext, c: LinkConfig): Values {
  const v: Values = new Map();
  for (const [k, t] of phaseTargets(phase, ctx, c)) v.set(k, t.to);
  return v;
}

export type SequenceKind = "link" | "tab" | "back";

/** Steps of a sequence (ms, at speed 1). */
export function stepsOf(kind: SequenceKind, c: LinkConfig): [number, Phase][] {
  if (kind === "link") {
    // Spec at 850 ms of rotation: deck at 650 ms, unfolding at 1 070 ms.
    const deck = Math.max(0, c.turnMs - 200);
    return [
      [0, "turn"],
      [deck, "deck"],
      [deck + 420, "spread"],
    ];
  }
  if (kind === "tab")
    return c.danceMs > 0
      ? [[0, "dance"]]
      : [
          [0, "deck"],
          [c.regroup, "spread"],
        ];
  return [
    [0, "close"],
    [c.regroup, "choose"],
  ];
}

interface Tween extends Target {
  from: number;
  /** Time the target was set (the step), start of the transition (after its delay). */
  set: number;
  at: number;
}

/**
 * A sequence from `start` values: `at(t)` gives every track at time t (ms). Tracks missing from
 * `start` begin at their value in `first` (the scene before it, at rest).
 */
export class Sequence {
  readonly duration: number;
  private readonly tracks = new Map<string, Tween[]>();

  constructor(
    readonly kind: SequenceKind,
    private readonly ctx: LinkContext,
    readonly config: LinkConfig,
    start: Values,
    first: Values,
  ) {
    const k = config.speed;
    let end = 0;
    for (const [at0, phase] of stepsOf(kind, config)) {
      const at = at0 / k;
      for (const [key, t] of phaseTargets(phase, ctx, config)) {
        const list = this.tracks.get(key) ?? [];
        // Like CSS: setting the same target again does not restart its transition.
        if (list.length && list[list.length - 1]!.to === t.to) continue;
        const from = list.length ? valueOf(list, at) : (start.get(key) ?? first.get(key) ?? t.to);
        const tw: Tween = { ...t, from, set: at, at: at + t.delay / k, dur: t.dur / k };
        list.push(tw);
        this.tracks.set(key, list);
        end = Math.max(end, tw.at + tw.dur);
      }
    }
    this.duration = Math.max(end, this.dancing ? danceSpan(config.danceMs) / k : 0);
  }

  private get dancing(): boolean {
    return this.kind === "tab" && this.config.danceMs > 0;
  }

  /** Every track at time t. */
  at(t: number, out: Values = new Map()): Values {
    for (const [key, list] of this.tracks) out.set(key, valueOf(list, t));
    if (this.dancing) {
      const k = this.config.speed;
      danceOverlay(out, this.ctx.slots, t, this.config.danceMs / k, DANCE.wave / k);
    }
    return out;
  }

  /** Phase shown at time t (the last step started), for the discrete parts (stacking order). */
  phaseAt(t: number): Phase {
    let p: Phase = "choose";
    for (const [at, phase] of stepsOf(this.kind, this.config))
      if (t >= at / this.config.speed) p = phase;
    return p;
  }
}

/** Value of a track made of successive transitions, at time t (CSS semantics). */
function valueOf(list: readonly Tween[], t: number): number {
  // The transition under way is the last one whose target was set at or before t.
  let tw = list[0]!;
  for (const x of list) if (x.set <= t) tw = x;
  if (t <= tw.at) return tw.from;
  if (tw.dur <= 0) return tw.to;
  return lerp(tw.from, tw.to, tw.ease(Math.min(1, (t - tw.at) / tw.dur)));
}
