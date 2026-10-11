import { describe, expect, it } from "vitest";
import { SPRINGS, springAt } from "../../../design/glass/pillMotion";
import { inheritKeys } from "../deckKeys";
import {
  deckOrder,
  FAN_SIZE,
  linkConfig,
  phaseTargets,
  restValues,
  Sequence,
  stepsOf,
  type LinkContext,
} from "./fanTimeline";

const SLOTS = [
  { k: 0, x: -428, s: 0.74 },
  { k: 1, x: -230, s: 0.74 },
  { k: 2, x: 0, s: 1 },
  { k: 3, x: 230, s: 0.74 },
  { k: 4, x: 428, s: 0.74 },
];
const ctx = (cat = 1, shuf = 0): LinkContext => ({ cat, shuf, slots: SLOTS });
const c = linkConfig(undefined);
const near = (a: number | undefined, b: number, eps = 0.01) =>
  expect(Math.abs((a ?? NaN) - b)).toBeLessThan(eps);

describe("category link A (round 3b): settings and phases", () => {
  it("defaults are the spec's values; Eco has no blur", () => {
    expect(c).toMatchObject({ angle: 7, pivot: 1300, exitAngle: 15, turnMs: 850, blur: 6 });
    expect(c).toMatchObject({ unfoldMs: 700, stagger: 70, regroup: 380, speed: 1 });
    expect(linkConfig(undefined, true).blur).toBe(0);
    expect(c.turn(0.5)).toBeCloseTo(0.5, 2); // cubic-bezier(.65,0,.35,1) is symmetric
  });

  it("the link turns at 0, gathers the deck at 650 ms and unfolds it at 1 070 ms", () => {
    expect(stepsOf("link", c)).toEqual([
      [0, "turn"],
      [650, "deck"],
      [1070, "spread"],
    ]);
    expect(stepsOf("tab", c)).toEqual([
      [0, "deck"],
      [380, "spread"],
    ]);
    expect(stepsOf("back", c)).toEqual([
      [0, "close"],
      [380, "choose"],
    ]);
  });

  it("fan at rest: 7° per rank, centre card in front; the others leave 15° per rank", () => {
    const fan = restValues("choose", ctx(), c);
    for (let i = 0; i < FAN_SIZE; i++) expect(fan.get(`c${i}.rot`)).toBe((i - 2) * 7);
    const turn = phaseTargets("turn", ctx(1), c);
    expect(turn.get("c1.rot")?.to).toBe(0);
    expect(turn.get("c1.ty")?.to).toBe(-30);
    expect(turn.get("c1.sc")?.to).toBe(1.06);
    expect(turn.get("c4.rot")?.to).toBe(45);
    expect(turn.get("c4.o")).toMatchObject({ to: 0, delay: 120, dur: 500 });
    expect(turn.get("c4.blur")?.to).toBe(6);
  });

  it("deck: 5 different stacking orders, offsets of 7 px and 3.5° per rank, scale 0.55", () => {
    for (let shuf = 0; shuf < 5; shuf++) {
      const ords = [0, 1, 2, 3, 4].map((k) => deckOrder(k, shuf));
      expect(new Set(ords).size).toBe(5);
    }
    expect(deckOrder(3, 0)).not.toBe(deckOrder(3, 1)); // the shuffle changes the order
    const deck = restValues("deck", ctx(), c);
    const off = deckOrder(0, 0) - 2;
    expect(deck.get("a0.x")).toBe(off * 7);
    expect(deck.get("a0.rot")).toBe(off * 3.5);
    expect(deck.get("a0.sc")).toBe(0.55);
    // Only the top card shows its face (the DOM text sits above the engine's glass).
    const faces = SLOTS.map(({ k }) => deck.get(`a${k}.f`));
    expect(faces.filter((f) => f === 1)).toHaveLength(1);
  });

  it("spread = the carousel at rest (the CSS takes over without a jump)", () => {
    const v = restValues("spread", ctx(), c);
    for (const s of SLOTS) {
      expect(v.get(`a${s.k}.x`)).toBe(s.x);
      expect(v.get(`a${s.k}.sc`)).toBe(s.s);
      expect(v.get(`a${s.k}.rot`)).toBe(0);
      expect(v.get(`a${s.k}.o`)).toBe(1);
    }
    expect(v.get("ring.o")).toBe(1);
    expect(v.get("ask.o")).toBe(0);
  });
});

describe("category link A: sequences", () => {
  const fan = restValues("choose", ctx(), c);

  it("link: chosen card centred and lifted at 850 ms, deck shown, carousel reached at the end", () => {
    const s = new Sequence("link", ctx(1), c, fan, fan);
    near(s.at(0).get("c1.rot"), -7);
    near(s.at(850).get("c1.rot"), 0);
    near(s.at(640).get("c1.ty"), -30);
    near(s.at(850).get("c3.rot"), 30);
    near(s.at(640).get("c3.o"), 0);
    expect(s.phaseAt(700)).toBe("deck");
    near(s.at(650).get("a2.o"), 0);
    near(s.at(1180).get("a2.o"), 1); // centre card: 70 ms after the others' start, 450 ms
    const end = s.at(s.duration);
    for (const x of SLOTS) near(end.get(`a${x.k}.x`), x.x);
    near(end.get("ring.y"), 0);
    // The ring is set at 650 ms and not restarted at 1 070 (same target, like CSS): .9 s.
    expect(s.duration).toBeCloseTo(1070 + 2 * 70 + 700, 0);
  });

  it("the unfolding passes its target by the 'liaison' spring (3.4 % of the travel)", () => {
    expect(SPRINGS.liaison).toBe(0.034);
    let peak = 0;
    for (let t = 0; t <= 1; t += 0.002) peak = Math.max(peak, springAt(t, 0.034));
    expect(peak).toBeCloseTo(1.034, 2);
    const s = new Sequence("link", ctx(), c, fan, fan);
    const from = s.at(1070).get("a4.x")!;
    let far = -Infinity;
    for (let t = 1070; t <= s.duration; t += 4) far = Math.max(far, s.at(t).get("a4.x")!);
    expect((far - 428) / (428 - from)).toBeGreaterThan(0.02);
    expect((far - 428) / (428 - from)).toBeLessThan(0.045);
  });

  it("a sequence started mid-way leaves from where the elements are (no jump)", () => {
    const a = new Sequence("link", ctx(1), c, fan, fan);
    const mid = new Map(a.at(400));
    const b = new Sequence("back", ctx(1), c, mid, restValues("spread", ctx(1), c));
    const start = b.at(0);
    for (const [key, v] of mid) near(start.get(key), v, 1e-6);
  });

  it("tab: new apps gather in a new order, unfold 380 ms later", () => {
    const rest = restValues("spread", ctx(1, 0), c);
    const s = new Sequence("tab", ctx(2, 1), c, rest, rest);
    near(s.at(0).get("a0.x"), -428);
    near(s.at(380).get("a2.sc"), s.at(380).get("a2.sc")!); // defined
    expect(s.phaseAt(379)).toBe("deck");
    expect(s.phaseAt(380)).toBe("spread");
    near(s.at(s.duration).get("a0.x"), -428);
  });

  it("speed scales every step and duration", () => {
    const slow = linkConfig({ on: true, speed: 0.5 });
    const s = new Sequence("link", ctx(), slow, fan, fan);
    expect(s.phaseAt(1290)).toBe("turn");
    expect(s.phaseAt(1300)).toBe("deck");
    expect(s.duration).toBeCloseTo((1070 + 140 + 700) * 2, 0);
  });
});

describe("carousel keys across a tab change (same cards, no remount)", () => {
  const ids = (p: string, n = 5) => Array.from({ length: n }, (_, i) => `${p}${i}`);

  it("inside a category a card keeps its key while the selection moves", () => {
    const a = inheritKeys(null, ids("a"), 0);
    const b = inheritKeys(a, ids("a"), 1);
    expect(b.keys.get("a0")).toBe(a.keys.get("a0"));
    expect(b.keys.get("a3")).toBe(a.keys.get("a3"));
  });

  it("a new list takes the keys of the old cards at the same place", () => {
    const a = inheritKeys(null, ids("a"), 2);
    const b = inheritKeys(a, ids("b"), 2);
    for (let i = 0; i < 5; i++) expect(b.keys.get(`b${i}`)).toBe(a.keys.get(`a${i}`));
    // Fewer apps: no key shared twice; more apps: fresh keys.
    const c2 = inheritKeys(b, ids("c", 2), 0);
    expect(new Set(c2.keys.values()).size).toBe(c2.keys.size);
    const d = inheritKeys(c2, ids("d", 7), 3);
    expect(new Set(d.keys.values()).size).toBe(d.keys.size);
  });

  it("going back to a list never gives two cards the same key", () => {
    let s = inheritKeys(null, ids("a"), 0);
    for (const p of ["b", "a", "c", "a", "b"]) {
      s = inheritKeys(s, ids(p), 1);
      expect(new Set(s.keys.values()).size).toBe(s.keys.size);
    }
  });
});
