import { describe, expect, it } from "vitest";
import { MAX_POSTERS, PosterTextures, RELEASE_FRAMES } from "./posterTextures";

/** Just enough of WebGL2 for the pool: counts live textures. */
function fakeGl(opts: { refuse?: boolean } = {}) {
  let live = 0;
  const gl = {
    TEXTURE0: 0,
    TEXTURE1: 1,
    TEXTURE_2D: 0,
    RGBA: 0,
    UNSIGNED_BYTE: 0,
    createTexture: () => (live++, {}),
    deleteTexture: () => void live--,
    activeTexture: () => {},
    bindTexture: () => {},
    pixelStorei: () => {},
    texParameteri: () => {},
    generateMipmap: () => {},
    texImage2D: () => {
      if (opts.refuse) throw new DOMException("tainted", "SecurityError");
    },
  };
  return { gl: gl as unknown as WebGL2RenderingContext, live: () => live };
}

const bitmap = (w = 400, h = 560) => ({ width: w, height: h, close: () => {} }) as ImageBitmap;
const flush = () => new Promise((r) => setTimeout(r, 0));

/** One engine frame: the cards showing `urls` ask for their slot. */
function frame(t: PosterTextures, urls: string[]): number[] {
  t.begin();
  const slots = urls.map((u) => t.slotFor(u));
  t.end();
  return slots;
}

describe("poster textures", () => {
  it("loads once per URL, uploads at most one per frame, then gives a slot", async () => {
    const { gl, live } = fakeGl();
    let loads = 0;
    const t = new PosterTextures(gl, () => (loads++, Promise.resolve(bitmap())));
    expect(frame(t, ["a", "b", "a"])).toEqual([-1, -1, -1]);
    await flush();
    expect(loads).toBe(2);
    frame(t, ["a", "b"]); // one upload
    expect(live()).toBe(1);
    frame(t, ["a", "b"]); // the other
    expect(live()).toBe(2);
    const slots = frame(t, ["a", "b", "a"]);
    expect(slots[0]).toBeGreaterThanOrEqual(0);
    expect(slots[2]).toBe(slots[0]); // same picture, same texture
    expect(t.aspect(slots[0]!)).toBeCloseTo(400 / 560);
  });

  it("releases a texture once no visible card uses it", async () => {
    const { gl, live } = fakeGl();
    const t = new PosterTextures(gl, () => Promise.resolve(bitmap()));
    frame(t, ["a"]);
    await flush();
    frame(t, ["a"]);
    expect(live()).toBe(1);
    for (let i = 0; i <= RELEASE_FRAMES; i++) frame(t, []);
    expect(live()).toBe(0);
  });

  it("never keeps more textures than allowed", async () => {
    const { gl, live } = fakeGl();
    const t = new PosterTextures(gl, () => Promise.resolve(bitmap()));
    const urls = Array.from({ length: MAX_POSTERS + 2 }, (_, i) => `p${i}`);
    frame(t, urls);
    await flush();
    for (let i = 0; i < urls.length + 2; i++) frame(t, urls);
    expect(live()).toBe(MAX_POSTERS);
    t.limit = 2;
    expect(frame(t, urls).filter((s) => s >= 2)).toEqual([]);
    expect(live()).toBe(2);
    t.dispose();
    expect(live()).toBe(0);
  });

  it("a refused picture (failed load or CORS) keeps its DOM image for good", async () => {
    const refused = fakeGl({ refuse: true });
    const t = new PosterTextures(refused.gl, () => Promise.resolve(bitmap()));
    frame(t, ["x"]);
    await flush();
    frame(t, ["x"]);
    expect(refused.live()).toBe(0);
    expect(frame(t, ["x"])).toEqual([-1]);

    let loads = 0;
    const u = new PosterTextures(fakeGl().gl, () => (loads++, Promise.reject(new Error("404"))));
    frame(u, ["y"]);
    await flush();
    frame(u, ["y"]);
    expect(frame(u, ["y"])).toEqual([-1]);
    expect(loads).toBe(1);
  });
});
