import { FULL_VERTEX, makeProgram, makeQuad, type Program } from "../../../fx/gpu/gl";
import { drawAtlas } from "../../../fx/mood/glyphAtlas";
import { RUNES, SEAL } from "../seal";
import { sealFrame, type SealFrame } from "../sealTimeline";
import { BACK_FRAGMENT, BACK_UNIFORMS } from "./backShader";
import { CardQuad } from "./cardQuad";
import {
  drawInstanced,
  fitCanvas,
  hash,
  instanced,
  makeTexture,
  project,
  sceneCanvas,
  type CinemaSetup,
  type Instanced,
} from "./glKit";
import {
  EMBER_FRAGMENT,
  EMBER_UNIFORMS,
  EMBER_VERTEX,
  FINAL_FRAGMENT,
  FINAL_UNIFORMS,
  FLAME_FRAGMENT,
  FLAME_UNIFORMS,
  FLAME_VERTEX,
} from "./partShaders";
import type { LaunchScene, SceneState } from "./scene";

const FLAMES = SEAL.flames.count;

/**
 * The launch scene « Sceau » on its own WebGL2 canvas over the hub (seal.ts, sealTimeline.ts):
 * built when the sequence starts, dropped when it ends; nothing runs outside it. The card's
 * plane is the screen (its first frame lies exactly over the card), the camera `P` px in front.
 */
export class SealCinema implements LaunchScene {
  private readonly progs: Record<"back" | "flame" | "ember" | "final", Program>;
  private readonly flames: Instanced;
  private readonly embers: Instanced;
  private readonly card: CardQuad;
  private readonly glyphs: WebGLTexture | null;
  private W = 1;
  private H = 1;
  private scale = 1;

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly canvas: HTMLCanvasElement,
    private readonly setup: CinemaSetup,
    progs: SealCinema["progs"],
    private readonly quad: WebGLVertexArrayObject,
  ) {
    this.progs = progs;
    this.flames = instanced(gl, FLAMES, 2);
    this.embers = instanced(gl, SEAL.embers, 1);
    this.card = new CardQuad(gl, setup);
    this.glyphs = makeTexture(gl, drawAtlas(RUNES), false);
    this.resize();
  }

  /** Null when WebGL2 or a program is refused (the launch then goes on without the scene). */
  static create(setup: CinemaSetup): SealCinema | null {
    const made = sceneCanvas();
    if (!made) return null;
    const { canvas, gl } = made;
    const make = (v: string, f: string, u: readonly string[]) => makeProgram(gl, v, f, u);
    const back = make(FULL_VERTEX, BACK_FRAGMENT, BACK_UNIFORMS);
    const flame = make(FLAME_VERTEX, FLAME_FRAGMENT, FLAME_UNIFORMS);
    const ember = make(EMBER_VERTEX, EMBER_FRAGMENT, EMBER_UNIFORMS);
    const final = make(FULL_VERTEX, FINAL_FRAGMENT, FINAL_UNIFORMS);
    const quad = makeQuad(gl);
    if (!back || !flame || !ember || !final || !quad) return null;
    const scene = new SealCinema(gl, canvas, setup, { back, flame, ember, final }, quad);
    if (!scene.card.ok) return null;
    setup.host.prepend(canvas);
    return scene;
  }

  resize(): void {
    const fit = fitCanvas(this.canvas, this.setup.eco ? SEAL.res.eco : SEAL.res.high);
    this.W = fit.W;
    this.H = fit.H;
    this.scale = fit.scale;
  }

  play(t: number, landed: number | null, skip: number | null): SceneState {
    const f = sealFrame(t, landed, skip);
    this.draw(f, t);
    return { done: f.done, caption: f.caption, hint: Math.min(f.cover, 1 - f.flash) * 0.8 };
  }

  private draw(f: SealFrame, tMs: number): void {
    const { gl, setup, W, H } = this;
    const { rect, a, b } = setup;
    const t = tMs / 1000;
    const P = SEAL.focal * H;
    const h = rect.h;
    const yg = SEAL.groundY * h;
    const R = SEAL.radius * h;
    const zs = R * SEAL.sealZ[0] + SEAL.sealZ[1];
    const O = [rect.x + rect.w / 2, rect.y + rect.h / 2] as const;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 1. The night, the ground circle, the upright seal.
    const back = this.use("back");
    gl.uniform2f(back.loc.uView!, W, H);
    gl.uniform1f(back.loc.uScale!, this.scale);
    gl.uniform2f(back.loc.uO!, O[0], O[1]);
    gl.uniform1f(back.loc.uP!, P);
    gl.uniform1f(back.loc.uT!, t);
    gl.uniform3f(back.loc.uA!, a[0], a[1], a[2]);
    gl.uniform3f(back.loc.uB!, b[0], b[1], b[2]);
    gl.uniform4f(back.loc.uK!, f.cover, f.smoke, f.swirl, f.fire);
    gl.uniform4f(back.loc.uGround!, yg, R, f.ground.draw, f.ground.runes);
    gl.uniform4f(back.loc.uSeal!, zs, SEAL.sealR * h * f.seal.size, f.seal.draw, f.seal.runes);
    gl.uniform4f(back.loc.uSeal2!, f.seal.alpha, f.seal.yaw, f.seal.spin, f.seal.star);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.glyphs);
    gl.uniform1i(back.loc.uGlyphs!, 0);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2. Flames behind the card, the card, flames in front; embers over all.
    const order = this.fillFlames(f, P, yg, R, h);
    const cardZ = f.card.z;
    this.drawFlames(
      order.filter((o) => o.z > cardZ),
      t,
    );
    const pose = { ...f.card, pitch: -4 * (f.card.z / SEAL.card.back), erase: 0 };
    this.card.draw(pose, t, { W, H, P }, { glow: a, edge: b, above: false });
    this.drawFlames(
      order.filter((o) => o.z <= cardZ),
      t,
    );
    this.drawEmbers(f, t, P, yg, R, h);

    // 3. Vignette, pillar, flash, black.
    const fin = this.use("final");
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(fin.loc.uView!, W, H);
    gl.uniform1f(fin.loc.uScale!, this.scale);
    gl.uniform2f(fin.loc.uO!, O[0], O[1]);
    gl.uniform3f(fin.loc.uA!, a[0], a[1], a[2]);
    gl.uniform3f(fin.loc.uB!, b[0], b[1], b[2]);
    gl.uniform4f(fin.loc.uF!, f.cover, f.pillar, f.flash, f.black);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private use(name: keyof SealCinema["progs"]): Program {
    const p = this.progs[name];
    this.gl.useProgram(p.program);
    return p;
  }

  /** Each flame's foot, size and depth this frame, far ones first. */
  private fillFlames(f: SealFrame, P: number, yg: number, R: number, h: number) {
    const out: { z: number; v: number[] }[] = [];
    for (let i = 0; i < FLAMES; i++) {
      const grow = f.flames[i] ?? 0;
      if (grow <= 0.001) continue;
      const phi = (i / FLAMES) * Math.PI * 2 + 0.2;
      const x = R * Math.cos(phi);
      const z = R * Math.sin(phi);
      const [sx, sy, k] = project(this.setup.rect, x, yg, z, P);
      const base = h * (SEAL.flameH[0] + (SEAL.flameH[1] - SEAL.flameH[0]) * hash(i, 12.9898));
      const height = base * grow * (1 + 0.75 * f.surge) * k;
      const width = base * SEAL.flameW * Math.min(1.1, grow) * (1 + 0.45 * f.surge) * k;
      const lean = -Math.sign(x) * 0.25 * f.surge + (hash(i, 7.7) - 0.5) * 0.12;
      const light = 0.72 + 0.28 * (0.5 - z / (2 * R));
      out.push({
        z,
        v: [sx, sy, width, height, hash(i, 3.1) * 10, Math.min(1, grow * 3), lean, light],
      });
    }
    return out.sort((p, q) => q.z - p.z);
  }

  private drawFlames(list: { v: number[] }[], t: number): void {
    if (list.length === 0) return;
    const { gl, flames, setup } = this;
    list.forEach((o, n) => flames.data.set(o.v, n * 8));
    const p = this.use("flame");
    gl.uniform2f(p.loc.uView!, this.W, this.H);
    gl.uniform1f(p.loc.uT!, t);
    gl.uniform3f(p.loc.uA!, ...setup.a);
    gl.uniform3f(p.loc.uB!, ...setup.b);
    drawInstanced(gl, flames, list.length, 2);
  }

  /** Embers rising from the flames' tips, fading as they go (by the fire's strength). */
  private drawEmbers(f: SealFrame, t: number, P: number, yg: number, R: number, h: number): void {
    const { gl, embers } = this;
    if (f.fire <= 0.01) return;
    let n = 0;
    for (let i = 0; i < SEAL.embers; i++) {
      const k = i % FLAMES;
      const life = 1.6 + 1.4 * hash(i, 4.1);
      const age = ((t / life + hash(i, 9.7)) % 1) * life;
      const phi = (k / FLAMES) * Math.PI * 2 + 0.2;
      const x = R * Math.cos(phi) + Math.sin(age * 3 + i) * 12 * age;
      const z = R * Math.sin(phi);
      const rise = (55 + 60 * hash(i, 2.3)) * age * (1 + f.surge);
      const y = yg - h * 0.45 * (f.flames[k] ?? 0) - rise;
      const [sx, sy, s] = project(this.setup.rect, x, y, z, P);
      const alpha = Math.sin((Math.PI * age) / life) * Math.min(1, f.fire);
      embers.data.set([sx, sy, (2 + 3 * hash(i, 5.5)) * s, alpha], n * 4);
      n++;
    }
    const p = this.use("ember");
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform2f(p.loc.uView!, this.W, this.H);
    gl.uniform3f(p.loc.uB!, ...this.setup.b);
    drawInstanced(gl, embers, n, 1);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {
    const gl = this.gl;
    for (const p of Object.values(this.progs)) gl.deleteProgram(p.program);
    this.card.dispose();
    gl.deleteTexture(this.glyphs);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas.remove();
  }
}
