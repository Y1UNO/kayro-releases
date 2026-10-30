import { FULL_VERTEX, makeProgram, makeQuad, type Program } from "../../../fx/gpu/gl";
import { GOMMAGE, gommageFrame, PAINT, type GommageFrame } from "../gommage";
import { CARD_CELLS, CardQuad, eraseWhen, type CardPose } from "./cardQuad";
import { numberArt, ornamentArt } from "./gommageArt";
import {
  GBACK_FRAGMENT,
  GBACK_UNIFORMS,
  GFINAL_FRAGMENT,
  GFINAL_UNIFORMS,
  PETAL_FRAGMENT,
  PETAL_UNIFORMS,
  PETAL_VERTEX,
} from "./gommageShaders";
import {
  drawInstanced,
  fitCanvas,
  hash,
  instanced,
  makeTexture,
  sceneCanvas,
  type CinemaSetup,
  type Instanced,
} from "./glKit";
import type { LaunchScene, SceneState } from "./scene";

const CELLS = CARD_CELLS[0] * CARD_CELLS[1];
const STRIDE = 12;

/**
 * The launch scene « Gommage » on its own WebGL2 canvas (gommage.ts): a painted night under a
 * spotlight, brushstrokes, a far monolith, gilded corners, petals in the wind; in the finale the
 * card is erased cell by cell and every cell flies off as a petal carrying its piece of the
 * poster. Built when the sequence starts, dropped when it ends.
 */
export class GommageCinema implements LaunchScene {
  private readonly progs: Record<"back" | "petal" | "final", Program>;
  private readonly petals: Instanced;
  private readonly card: CardQuad;
  private readonly number: WebGLTexture | null;
  private readonly orn: WebGLTexture | null;
  private W = 1;
  private H = 1;
  private scale = 1;

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly canvas: HTMLCanvasElement,
    private readonly setup: CinemaSetup,
    progs: GommageCinema["progs"],
    private readonly quad: WebGLVertexArrayObject,
  ) {
    this.progs = progs;
    this.petals = instanced(gl, GOMMAGE.ambient + CELLS, 3);
    this.card = new CardQuad(gl, setup);
    this.number = makeTexture(gl, numberArt(GOMMAGE.number), true);
    this.orn = makeTexture(gl, ornamentArt(), false);
    this.resize();
  }

  static create(setup: CinemaSetup): GommageCinema | null {
    const made = sceneCanvas();
    if (!made) return null;
    const { canvas, gl } = made;
    const back = makeProgram(gl, FULL_VERTEX, GBACK_FRAGMENT, GBACK_UNIFORMS);
    const petal = makeProgram(gl, PETAL_VERTEX, PETAL_FRAGMENT, PETAL_UNIFORMS);
    const final = makeProgram(gl, FULL_VERTEX, GFINAL_FRAGMENT, GFINAL_UNIFORMS);
    const quad = makeQuad(gl);
    if (!back || !petal || !final || !quad) return null;
    const scene = new GommageCinema(gl, canvas, setup, { back, petal, final }, quad);
    if (!scene.card.ok) return null;
    setup.host.prepend(canvas);
    return scene;
  }

  resize(): void {
    const fit = fitCanvas(this.canvas, this.setup.eco ? GOMMAGE.res.eco : GOMMAGE.res.high);
    this.W = fit.W;
    this.H = fit.H;
    this.scale = fit.scale;
  }

  play(t: number, landed: number | null, skip: number | null): SceneState {
    const f = gommageFrame(t, landed, skip);
    this.draw(f, t);
    return { done: f.done, caption: f.caption, hint: Math.min(f.cover, 1 - f.flash) * 0.8 };
  }

  private draw(f: GommageFrame, tMs: number): void {
    const { gl, setup, W, H } = this;
    const { rect } = setup;
    const t = tMs / 1000;
    const P = GOMMAGE.focal * H;
    const O = [rect.x + rect.w / 2, rect.y + rect.h / 2] as const;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 1. The painted canvas: spotlight, strokes, the monolith and its number, gilded corners.
    const back = this.use("back");
    gl.uniform2f(back.loc.uView!, W, H);
    gl.uniform1f(back.loc.uScale!, this.scale);
    gl.uniform2f(back.loc.uO!, O[0], O[1]);
    gl.uniform1f(back.loc.uT!, t);
    gl.uniform4f(back.loc.uK!, f.cover, f.light, f.strokes, f.filigree);
    gl.uniform4f(back.loc.uMono!, f.mono.rise, f.mono.paint, f.mono.glow, f.erase);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.orn);
    gl.uniform1i(back.loc.uOrn!, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.number);
    gl.uniform1i(back.loc.uNumber!, 0);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2. Far petals, the card, the card's own petals, near petals.
    const pose: CardPose = { ...f.card, pitch: 0, burn: 0, erase: f.erase };
    this.drawPetals(this.ambient(f, false, 0), O, f.light);
    this.card.draw(pose, t, { W, H, P }, { glow: PAINT.gold, edge: PAINT.crimson, above: true });
    const n = this.fromCard(f, pose, tMs, P, 0);
    this.drawPetals(this.ambient(f, true, n), O, f.light);

    // 3. Vignette, flare, blank canvas, black.
    const fin = this.use("final");
    gl.uniform2f(fin.loc.uView!, W, H);
    gl.uniform1f(fin.loc.uScale!, this.scale);
    gl.uniform2f(fin.loc.uO!, O[0], O[1]);
    gl.uniform4f(fin.loc.uF!, f.cover, f.flare, f.flash, f.black);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private use(name: keyof GommageCinema["progs"]): Program {
    const p = this.progs[name];
    this.gl.useProgram(p.program);
    return p;
  }

  /**
   * Petals in the wind (far ones behind the card; near ones and a few out of focus in front),
   * after `from` others: mostly crimson, some brick, pale or gold, glowing softly.
   */
  private ambient(f: GommageFrame, near: boolean, from: number): number {
    const { W, H } = this;
    const data = this.petals.data;
    const count = this.setup.eco ? GOMMAGE.ambient / 2 : GOMMAGE.ambient;
    let n = from;
    for (let i = 0; i < count; i++) {
      const d = 0.45 + hash(i, 1.7);
      const bokeh = hash(i, 12.1) > 0.95;
      if ((d >= 1.05 || bokeh) !== near) continue;
      const shown = Math.min(1, (f.petals - hash(i, 9.1)) / 0.08);
      if (shown <= 0) continue;
      const wide = W + 300;
      const tall = H + 200;
      const x =
        (((hash(i, 3.7) * wide + (40 + 50 * hash(i, 2.1)) * d * f.windT) % wide) + wide) % wide;
      const drift = (-12 + 24 * hash(i, 6.1)) * d * f.windT + Math.sin(f.windT * 0.7 + i) * 35 * d;
      const y = (((hash(i, 5.3) * tall + drift) % tall) + tall) % tall;
      const turn = (hash(i, 2.9) > 0.5 ? 1 : -1) * (0.4 + 0.9 * hash(i, 4.4));
      const h = hash(i, 6.6);
      data.set(
        [
          x - 150,
          y - 100,
          (12 + 10 * hash(i, 7.9)) * d * (bokeh ? 2.6 : 1),
          hash(i, 8.3) * 6.28 + turn * f.windT,
          hash(i, 1.3) * 6.28 + (1 + 1.6 * hash(i, 3.9)) * f.windT,
          shown * Math.min(1, f.cover * 1.5) * (bokeh ? 0.35 : 0.95),
          bokeh ? 0.45 : 0,
          bokeh ? 0.9 : 0.8,
          -1,
          0,
          0,
          // Out of focus: warm only (a pale blur reads as a smudge).
          bokeh ? (h < 0.7 ? 0 : 3) : h < 0.6 ? 0 : h < 0.75 ? 1 : h < 0.88 ? 2 : 3,
        ],
        n * STRIDE,
      );
      n++;
    }
    return n;
  }

  /** The card's cells already erased, each a petal flying off with its piece of the poster. */
  private fromCard(f: GommageFrame, pose: CardPose, tMs: number, P: number, from: number): number {
    if (f.erase <= 0) return from;
    const [cx, cy] = CARD_CELLS;
    const [e0, e1] = GOMMAGE.finale.erase;
    const cellW = this.setup.rect.w / cx;
    const data = this.petals.data;
    let n = from;
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        const when = eraseWhen(i, j);
        if (f.erase < when) continue;
        const age = (tMs - (f.finaleAt + e0 + when * (e1 - e0))) / 1000;
        if (age < 0) continue;
        const u = (i + 0.5) / cx;
        const v = (j + 0.5) / cy;
        const [sx, sy, k] = this.card.pointOf(pose, u, v, P);
        const seed = i * 31 + j * 17 + 1;
        const vx = 220 + 200 * hash(seed, 1.1);
        const vy = -(70 + 110 * hash(seed, 2.2));
        const x = sx + vx * age + Math.sin(age * 5 + seed) * 18 * age;
        const y = sy + vy * age - 40 * age * age;
        const fade = 1 - Math.min(1, Math.max(0, (age - 1) / 0.6));
        data.set(
          [
            x,
            y,
            cellW * 1.25 * k * (1 - 0.25 * Math.min(age, 1)),
            hash(seed, 3.3) * 6.28 + (2 + 3 * hash(seed, 4.4)) * age,
            (3 + 4 * hash(seed, 5.5)) * age,
            fade,
            0,
            0.5,
            u,
            v,
            Math.min(1, age * 0.9),
            0,
          ],
          n * STRIDE,
        );
        n++;
      }
    }
    return n;
  }

  private drawPetals(count: number, O: readonly [number, number], light: number): void {
    const { gl } = this;
    if (count <= 0) return;
    const p = this.use("petal");
    gl.uniform2f(p.loc.uView!, this.W, this.H);
    gl.uniform2f(p.loc.uO!, O[0], O[1]);
    gl.uniform1f(p.loc.uLight!, light);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.card.poster);
    gl.uniform1i(p.loc.uPoster!, 1);
    gl.uniform1f(p.loc.uHas!, this.card.poster ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    drawInstanced(gl, this.petals, count, 3);
  }

  dispose(): void {
    const gl = this.gl;
    for (const p of Object.values(this.progs)) gl.deleteProgram(p.program);
    this.card.dispose();
    gl.deleteTexture(this.number);
    gl.deleteTexture(this.orn);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas.remove();
  }
}
