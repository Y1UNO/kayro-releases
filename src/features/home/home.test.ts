import { describe, expect, it } from "vitest";
import type { AppEntry } from "../../ipc/bindings";
import { CATEGORY_IDS, categoryOf, groupByCategory } from "./categories";
import { monogram, shadeOf } from "./cardLook";
import {
  GAP,
  SIDE_SCALE,
  SIDE_W,
  SLOT,
  cardLeft,
  clampIndex,
  isVisible,
  mountedRange,
  slotOffset,
} from "./carouselGeometry";
import { homeReducer, initialHomeState } from "./homeState";
import { normalize, searchHome } from "./search";

function app(id: string, name: string, category = "jeux", favorite = false): AppEntry {
  return {
    id,
    name,
    category,
    favorite,
    source: { kind: "manual" },
    launch: { kind: "exe", path: "C:/x.exe", args: [], cwd: null, elevated: false },
    match: { exe: null },
    art: { poster: null, hero: null },
    moodId: null,
  };
}

describe("carousel geometry", () => {
  it("centres the active card and keeps a 20 px gap on both sides", () => {
    expect(cardLeft(0)).toBe(-116);
    // Right neighbour starts one gap after the active card's right edge (+116).
    expect(cardLeft(1)).toBe(116 + GAP);
    // Left neighbour ends one gap before the active card's left edge (-116).
    expect(cardLeft(-1) + SIDE_W).toBe(-116 - GAP);
  });

  it("spaces side cards by their width plus the gap, and is mirror-symmetric", () => {
    expect(cardLeft(2) - cardLeft(1)).toBe(SIDE_W + GAP);
    expect(cardLeft(-1) - cardLeft(-2)).toBe(SIDE_W + GAP);
    for (const d of [1, 2, 3]) expect(cardLeft(d) + SIDE_W).toBe(-cardLeft(-d));
    // The five visible cards span 232 + 4 x 172 + 4 x 20 = 1000 px, centred.
    expect(2 * (cardLeft(2) + SIDE_W)).toBe(SLOT.w + 4 * SIDE_W + 4 * GAP);
  });

  it("shows five cards: active and two on each side", () => {
    expect([-3, -2, -1, 0, 1, 2, 3].map(isVisible)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it("places each slot so that its card ends up at the right spot", () => {
    // The slot is centred on the stage by CSS and moved by slotOffset: its centre is the card's centre.
    for (const d of [-2, -1, 0, 1, 2]) {
      const w = d === 0 ? SLOT.w : SIDE_W;
      expect(slotOffset(d)).toBeCloseTo(cardLeft(d) + w / 2, 6);
    }
    expect(slotOffset(0)).toBe(0);
    expect(slotOffset(1)).toBe(-slotOffset(-1));
    expect(SIDE_SCALE * SLOT.w).toBeCloseTo(SIDE_W, 6);
  });

  it("clamps indices and bounds the mounted range", () => {
    expect(clampIndex(-4, 10)).toBe(0);
    expect(clampIndex(99, 10)).toBe(9);
    expect(clampIndex(3, 0)).toBe(0);
    expect(mountedRange(0, 60)).toEqual([0, 3]);
    expect(mountedRange(30, 60)).toEqual([27, 33]);
    expect(mountedRange(59, 60)).toEqual([56, 59]);
    expect(mountedRange(1, 2)).toEqual([0, 1]);
  });
});

describe("categories", () => {
  it("falls back to 'autres' for an unknown category", () => {
    expect(categoryOf({ category: "jeux" })).toBe("jeux");
    expect(categoryOf({ category: "whatever" })).toBe("autres");
  });

  it("groups apps, favourites first, otherwise keeping the file order", () => {
    const g = groupByCategory([
      app("a", "A"),
      app("b", "B", "jeux", true),
      app("c", "C", "stream"),
      app("d", "D", "???"),
      app("e", "E"),
    ]);
    expect(g.jeux.map((x) => x.id)).toEqual(["b", "a", "e"]);
    expect(g.stream.map((x) => x.id)).toEqual(["c"]);
    expect(g.autres.map((x) => x.id)).toEqual(["d"]);
    expect(Object.keys(g)).toEqual([...CATEGORY_IDS]);
  });
});

describe("home state", () => {
  it("opens each category on its third app (5 cards shown), fewer apps: the last one", () => {
    const s = initialHomeState("jeux", {
      jeux: 12,
      stream: 5,
      creativite: 2,
      logiciels: 1,
      autres: 0,
    });
    expect(s.focus).toEqual({ jeux: 2, stream: 2, creativite: 1, logiciels: 0, autres: 0 });
    expect(initialHomeState().focus.jeux).toBe(2);
  });

  it("remembers the selection of each category", () => {
    let s = initialHomeState();
    s = homeReducer(s, { type: "moveFocus", delta: 2, count: 5 });
    s = homeReducer(s, { type: "setCategory", category: "stream" });
    expect(s.focus.stream).toBe(2);
    s = homeReducer(s, { type: "setCategory", category: "jeux" });
    expect(s.focus.jeux).toBe(4);
  });

  it("stops at both ends instead of wrapping", () => {
    let s = homeReducer(initialHomeState(), { type: "setFocus", index: 0, count: 3 });
    s = homeReducer(s, { type: "moveFocus", delta: -1, count: 3 });
    expect(s.focus.jeux).toBe(0);
    s = homeReducer(s, { type: "moveFocus", delta: 10, count: 3 });
    expect(s.focus.jeux).toBe(2);
    s = homeReducer(s, { type: "stepCategory", delta: 1 });
    expect(s.category).toBe("stream");
    s = homeReducer(initialHomeState("autres"), { type: "stepCategory", delta: 1 });
    expect(s.category).toBe("autres");
  });

  it("returns the same state when nothing changes (no useless render)", () => {
    const s = homeReducer(initialHomeState(), { type: "setFocus", index: 0, count: 4 });
    expect(homeReducer(s, { type: "setCategory", category: "jeux" })).toBe(s);
    expect(homeReducer(s, { type: "moveFocus", delta: -1, count: 4 })).toBe(s);
    expect(homeReducer(s, { type: "setView", view: "carousel" })).toBe(s);
  });
});

describe("search", () => {
  const label = (id: string) =>
    ({
      jeux: "Jeux",
      stream: "Stream",
      creativite: "Créativité",
      logiciels: "Logiciels",
      autres: "Autre",
    })[id] ?? id;
  const apps = [
    app("1", "Steam"),
    app("2", "Blender", "creativite"),
    app("3", "OBS Studio", "stream"),
  ];

  it("ignores case and accents", () => {
    expect(normalize("  CRÉATIVITÉ ")).toBe("creativite");
    const r = searchHome("creativ", apps, label);
    expect(r[0]).toEqual({ kind: "category", id: "creativite" });
  });

  it("ranks names that start with the query before names that contain it", () => {
    const r = searchHome("st", apps, label);
    const names = r.map((x) => (x.kind === "app" ? x.app.name : x.id));
    // categories first ("stream" starts with st), then Steam (starts) before OBS Studio (contains).
    expect(names).toEqual(["stream", "Steam", "OBS Studio"]);
  });

  it("lists everything for an empty query and nothing for a miss", () => {
    expect(searchHome("", apps, label)).toHaveLength(5 + 3);
    expect(searchHome("zzzz", apps, label)).toEqual([]);
  });

  it("caps the number of results", () => {
    const many = Array.from({ length: 200 }, (_, i) => app(String(i), `App ${i}`));
    expect(searchHome("app", many, label).length).toBeLessThanOrEqual(60);
  });
});

describe("card look", () => {
  it("takes the first letter or digit as monogram", () => {
    expect(monogram("steam")).toBe("S");
    expect(monogram("  7-Zip")).toBe("7");
    expect(monogram("épique")).toBe("É");
    expect(monogram("—")).toBe("·");
  });

  it("gives an app the same shade every time", () => {
    expect(shadeOf("minecraft")).toBe(shadeOf("minecraft"));
    expect([0.9, 0.95, 1, 1.05, 1.1]).toContain(shadeOf("x"));
  });
});
