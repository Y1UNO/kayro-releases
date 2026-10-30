import {
  BG_FRAGMENT,
  BG_UNIFORMS,
  SPRITE_FRAGMENT,
  SPRITE_UNIFORMS,
  SPRITE_VERTEX,
} from "./bgShader";
import {
  dropTarget,
  FULL_VERTEX,
  makeProgram,
  makeQuad,
  makeTarget,
  type Program,
  type Target,
} from "./gl";
import { GLASS_FRAGMENT, GLASS_UNIFORMS } from "./glassShader";
import { HERO_UNITS } from "./heroTexture";
import { MAX_POSTERS } from "./posterTextures";
import { MAX_SPRITES, SPRITE_FLOATS } from "./scene";
import { drawAtlas } from "../mood/glyphAtlas";

/** Texture unit of the ambience's glyphs (units 1–6 posters, 7–8 hero). */
const GLYPH_UNIT = 9;

/** The glyphs of the shown ambience (steps 16–17): the atlas is redrawn when `version` changes. */
export interface GlyphSet {
  glyphPaths: readonly string[];
  version: number;
}

/** Poster samplers of the glass pass: uP0 … on texture units 1 … (unit 0 = background). */
const POSTER_UNITS: Uniforms = Object.fromEntries(
  Array.from({ length: MAX_POSTERS }, (_, i) => [`uP${i}`, i + 1]),
);
const INT_UNIFORMS = new Set([
  "uTex",
  "uN",
  "uNS",
  "uNested",
  "uGlyphs",
  ...Object.keys(POSTER_UNITS),
  ...Object.keys(HERO_UNITS),
]);

/** Uniform values: name → numbers (vec2/3/4 or arrays as flat lists). */
export type Uniforms = Record<string, number | readonly number[] | Float32Array>;

/**
 * GPU side of the glass engine: the programs and the background target.
 *   1. background shader + sprites → A (the liquid ring is drawn by the background shader)
 *   2. mips of A, then the glass pass onto the canvas (it refracts them).
 */
export class Renderer {
  private readonly bg: Program;
  private readonly sprite: Program;
  private readonly glass: Program;
  private readonly quad: WebGLVertexArrayObject;
  private readonly spriteVao: WebGLVertexArrayObject;
  private readonly spriteBuf: WebGLBuffer;
  private a: Target | null = null;
  private glyphTex: WebGLTexture | null = null;
  private glyphVersion = -1;

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    p: [Program, Program, Program],
    quad: WebGLVertexArrayObject,
    sprite: [WebGLVertexArrayObject, WebGLBuffer],
  ) {
    [this.bg, this.sprite, this.glass] = p;
    this.quad = quad;
    [this.spriteVao, this.spriteBuf] = sprite;
  }

  /** `null` when a shader is refused or a resource cannot be created. */
  static create(gl: WebGL2RenderingContext): Renderer | null {
    const bg = makeProgram(gl, FULL_VERTEX, BG_FRAGMENT, BG_UNIFORMS);
    const sprite = makeProgram(gl, SPRITE_VERTEX, SPRITE_FRAGMENT, SPRITE_UNIFORMS);
    const glass = makeProgram(gl, FULL_VERTEX, GLASS_FRAGMENT, GLASS_UNIFORMS);
    const quad = makeQuad(gl);
    if (!bg || !sprite || !glass || !quad) return null;
    const vao = gl.createVertexArray();
    const corners = gl.createBuffer();
    const inst = gl.createBuffer();
    if (!vao || !corners || !inst) return null;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_SPRITES * SPRITE_FLOATS * 4, gl.DYNAMIC_DRAW);
    const stride = SPRITE_FLOATS * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    return new Renderer(gl, [bg, sprite, glass], quad, [vao, inst]);
  }

  /** (Re)creates the targets at the canvas size; false if the driver refuses them. */
  resize(w: number, h: number): boolean {
    if (this.a && this.a.w === w && this.a.h === h) return true;
    dropTarget(this.gl, this.a);
    this.a = makeTarget(this.gl, w, h);
    return this.a !== null;
  }

  render(
    bg: Uniforms,
    sprites: { data: Float32Array; count: number; u: Uniforms; glyphs?: GlyphSet },
    glass: Uniforms,
    bindPosters: (() => void) | null = null,
    bindHero: (() => void) | null = null,
    drawArt: (() => void) | null = null,
  ): void {
    const { gl, a } = this;
    if (!a) return;
    gl.viewport(0, 0, a.w, a.h);
    gl.disable(gl.BLEND);

    // 1. Background → A (the immersive hero on units 7–8, step 14).
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb);
    bindHero?.();
    this.use(this.bg, bg);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    drawArt?.(); // steps 16–17: the special card's characters and logo, behind the sprites
    if (sprites.count > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      this.bindGlyphs(sprites.glyphs);
      this.use(this.sprite, { ...sprites.u, uGlyphs: GLYPH_UNIT });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sprites.data, 0, sprites.count * SPRITE_FLOATS);
      gl.bindVertexArray(this.spriteVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, sprites.count);
      gl.disable(gl.BLEND);
    }

    // 2. Mips of the background, glass pass onto the canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    bindPosters?.(); // poster textures on units 1…6 (round 2b)
    this.use(this.glass, { ...glass, uTex: 0, ...POSTER_UNITS });
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    dropTarget(gl, this.a);
    this.a = null;
    gl.deleteTexture(this.glyphTex);
    this.glyphTex = null;
    for (const p of [this.bg, this.sprite, this.glass]) gl.deleteProgram(p.program);
  }

  /** Uploads the ambience's glyph atlas once per ambience, binds it on its unit. */
  private bindGlyphs(g: GlyphSet | undefined): void {
    const gl = this.gl;
    if (!g || g.glyphPaths.length === 0) return;
    if (!this.glyphTex) this.glyphTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + GLYPH_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.glyphTex);
    if (g.version !== this.glyphVersion) {
      this.glyphVersion = g.version;
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, drawAtlas(g.glyphPaths));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.activeTexture(gl.TEXTURE0);
  }

  private use(p: Program, u: Uniforms): void {
    const gl = this.gl;
    gl.useProgram(p.program);
    for (const [name, v] of Object.entries(u)) {
      const loc = p.loc[name];
      if (loc === undefined || loc === null) continue;
      if (typeof v === "number") {
        if (INT_UNIFORMS.has(name)) gl.uniform1i(loc, v);
        else gl.uniform1f(loc, v);
      } else if (v instanceof Float32Array) {
        gl.uniform4fv(loc, v); // arrays of vec4
      } else if (v.length === 2) gl.uniform2f(loc, v[0]!, v[1]!);
      else if (v.length === 3) gl.uniform3f(loc, v[0]!, v[1]!, v[2]!);
      else if (v.length === 4) gl.uniform4f(loc, v[0]!, v[1]!, v[2]!, v[3]!);
    }
  }
}
