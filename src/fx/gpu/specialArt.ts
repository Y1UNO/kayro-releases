import type { FxPalette, FxTarget } from "../FxLayer";
import { makeProgram, makeQuad, type Program } from "./gl";
import { ART_SHADER, SPECIAL } from "./specialShader";

/** Texture unit of the picture being drawn (units 1–6 posters, 7–8 hero, 9 glyphs). */
const UNIT = 10;
/** Pictures are decoded at most this tall (drawn at most ~0.9 × the window's height). */
const MAX_H = 1600;

interface Picture {
  url: string;
  tex: WebGLTexture | null;
  aspect: number;
}

async function load(url: string): Promise<ImageBitmap> {
  const img = new Image();
  img.crossOrigin = "anonymous"; // `kayro-art` is another origin: WebGL needs CORS
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const k = Math.min(1, MAX_H / img.naturalHeight);
  return createImageBitmap(img, {
    resizeWidth: Math.max(1, Math.round(img.naturalWidth * k)),
    resizeHeight: Math.max(1, Math.round(img.naturalHeight * k)),
    resizeQuality: "high",
    premultiplyAlpha: "premultiply",
  });
}

type Slot = "left" | "right" | "logo";
const SLOTS: readonly Slot[] = ["left", "right", "logo"];

/**
 * Steps 16–17, the special card: the user's cut-out characters on both sides of the shown card and
 * the game's logo under it, drawn into the background (so the glass refracts them and the cards
 * stay in front), tinted by the palette in their shadows, a rim of the moon's light on the edge
 * that faces it, their feet and outer edge fading into the mist; the centre stays free. They
 * breathe slowly (scale and height, by the ambience's clock) and fade in and out (600 ms).
 */
export class SpecialArt {
  private readonly prog: Program | null;
  private readonly quad: WebGLVertexArrayObject | null;
  private readonly pics: Record<Slot, Picture | null> = { left: null, right: null, logo: null };
  private alpha = 0;
  private want = 0;
  private t = 0;
  private last = 0;
  private reduced = false;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.prog = makeProgram(gl, ART_SHADER.vertex, ART_SHADER.fragment, ART_SHADER.uniforms);
    this.quad = makeQuad(gl);
  }

  set(s: FxPalette["special"], reduced: boolean, onReady: () => void): void {
    this.reduced = reduced;
    this.want = s && (s.left || s.right) ? 1 : 0;
    if (reduced) this.alpha = this.want;
    for (const slot of SLOTS) {
      const url = (this.want ? s?.[slot] : null) ?? null;
      if (url === (this.pics[slot]?.url ?? null)) continue;
      this.drop(slot);
      if (!url) continue;
      const pic: Picture = { url, tex: null, aspect: 1 };
      this.pics[slot] = pic;
      load(url)
        .then((bmp) => {
          if (this.pics[slot] !== pic) return bmp.close();
          const gl = this.gl;
          pic.tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, pic.tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          pic.aspect = bmp.width / Math.max(1, bmp.height);
          bmp.close();
          onReady();
        })
        .catch(() => {
          // Missing or refused: that layer is simply not drawn.
        });
    }
  }

  /** Something to draw, or a fade running: the engine keeps its frames. */
  get animated(): boolean {
    const some = SLOTS.some((s) => this.pics[s]?.tex);
    return some && (!this.reduced || this.alpha !== this.want);
  }

  step(now: number): void {
    const dt = this.last ? Math.min(100, now - this.last) : 0;
    this.last = now;
    if (!this.reduced) this.t += dt / 1000;
    const d = this.want - this.alpha;
    this.alpha += Math.sign(d) * Math.min(Math.abs(d), dt / SPECIAL.fadeMs);
  }

  /** Draws into the bound target (the background), W × H CSS px. */
  draw(p: FxPalette, focus: FxTarget | null, W: number, H: number): void {
    const { gl, prog, quad } = this;
    if (!prog || !quad || this.alpha <= 0.002) return;
    const fx = focus?.x ?? W / 2;
    const bottom = focus?.bottom ?? H * 0.68;
    const tint = p.a.map((v) => v / 255);
    const rim = p.b.map((v) => (v / 255) * 0.5 + 0.5);
    gl.useProgram(prog.program);
    gl.bindVertexArray(quad);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(prog.loc.uView!, W, H);
    gl.uniform1i(prog.loc.uTex!, UNIT);
    gl.uniform3f(prog.loc.uTint!, tint[0]!, tint[1]!, tint[2]!);
    gl.uniform3f(prog.loc.uRim!, rim[0]!, rim[1]!, rim[2]!);
    const breathe = Math.sin((Math.PI * 2 * this.t) / SPECIAL.breathS);
    for (const side of [-1, 1] as const) {
      const pic = this.pics[side < 0 ? "left" : "right"];
      if (!pic?.tex) continue;
      const h = H * SPECIAL.height * (1 + 0.006 * breathe * side);
      const w = h * pic.aspect;
      const inner = fx + side * W * SPECIAL.gap;
      const x = side < 0 ? Math.max(inner - w, -w * 0.4) : Math.min(inner, W - w * 0.6);
      const y = H * SPECIAL.foot - h + 3 * breathe;
      this.quadOf(pic, [x, y, w, h], [this.alpha, SPECIAL.tint, SPECIAL.rim, SPECIAL.dark]);
      gl.uniform4f(prog.loc.uFade!, SPECIAL.footFade, side, SPECIAL.sideFade, 0);
      gl.uniform2f(prog.loc.uLight!, -side * 0.6, -0.8);
      gl.uniform2f(prog.loc.uRimR!, SPECIAL.rimPx / w, SPECIAL.rimPx / h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    const logo = this.pics.logo;
    if (logo?.tex) {
      const room = Math.max(0, H * SPECIAL.logoFloor - bottom);
      const h = Math.min(
        SPECIAL.logoMaxH,
        room * SPECIAL.logoRoom,
        (W * SPECIAL.logoMaxW) / logo.aspect,
      );
      const w = h * logo.aspect;
      const y = bottom + (room - h) / 2;
      this.quadOf(logo, [fx - w / 2, y, w, h], [this.alpha * SPECIAL.logoAlpha, 0, 0, 1]);
      gl.uniform4f(prog.loc.uFade!, 0, 0, 0.1, 0);
      gl.uniform2f(prog.loc.uRimR!, 0, 0);
      if (h > 8) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND);
  }

  private quadOf(pic: Picture, rect: number[], k: number[]): void {
    const { gl, prog } = this;
    gl.activeTexture(gl.TEXTURE0 + UNIT);
    gl.bindTexture(gl.TEXTURE_2D, pic.tex);
    gl.uniform4f(prog!.loc.uRect!, rect[0]!, rect[1]!, rect[2]!, rect[3]!);
    gl.uniform4f(prog!.loc.uK!, k[0]!, k[1]!, k[2]!, k[3]!);
  }

  private drop(slot: Slot): void {
    const tex = this.pics[slot]?.tex;
    if (tex) this.gl.deleteTexture(tex);
    this.pics[slot] = null;
  }

  dispose(): void {
    for (const s of SLOTS) this.drop(s);
    if (this.prog) this.gl.deleteProgram(this.prog.program);
  }
}
