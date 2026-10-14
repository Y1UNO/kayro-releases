import { GAME_COLORS } from "../../design/motion/tokens14";
import type { FxPalette } from "../FxLayer";
import type { Uniforms } from "./renderer";

/** Texture units of the background pass (the glass pass uses 0 for the background, 1–6 posters). */
export const HERO_UNITS = { uHero0: 7, uHero1: 8 } as const;
/** A sharp hero is decoded at most this wide: the engine blurs it by its mipmaps anyway. */
const MAX_W = 1024;

interface Hero {
  url: string;
  tex: WebGLTexture | null;
  aspect: number;
  /** Mip level to sample: 0 for a picture Steam already blurred, `sharpLod` otherwise. */
  lod: number;
  /** Fade-in (0–1): a picture decoded after the tide started appears softly. */
  shown: number;
}

async function load(url: string): Promise<ImageBitmap> {
  const img = new Image();
  img.crossOrigin = "anonymous"; // `kayro-art` is another origin: WebGL needs CORS
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const k = Math.min(1, MAX_W / img.naturalWidth);
  return createImageBitmap(img, {
    resizeWidth: Math.max(1, Math.round(img.naturalWidth * k)),
    resizeHeight: Math.max(1, Math.round(img.naturalHeight * k)),
    resizeQuality: "high",
  });
}

/**
 * The game's hero at the top of the immersive night (step 14, V3 b): two slots, the old picture
 * and the new one, mixed by the tide like the colours. Decoded off the main thread, uploaded once,
 * deleted when replaced. A picture that cannot be loaded is simply not drawn.
 */
export class HeroTextures {
  private old: Hero | null = null;
  private cur: Hero | null = null;
  private readonly blank: WebGLTexture | null;
  private last = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.blank = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }

  /** The palette's hero; `tide`: the current one stays as the old one while the tide runs. */
  set(hero: FxPalette["hero"], tide: boolean, reduced: boolean, onReady: () => void): void {
    if ((hero?.url ?? null) === (this.cur?.url ?? null)) return;
    this.drop(this.old);
    this.old = tide ? this.cur : null;
    if (!tide) this.drop(this.cur);
    this.cur = null;
    if (!hero) return;
    const next: Hero = { url: hero.url, tex: null, aspect: 3, lod: 0, shown: reduced ? 1 : 0 };
    next.lod = hero.blurred ? 0 : GAME_COLORS.hero.sharpLod;
    this.cur = next;
    load(hero.url)
      .then((bmp) => {
        if (this.cur !== next) return bmp.close();
        const gl = this.gl;
        next.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, next.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        next.aspect = bmp.width / Math.max(1, bmp.height);
        bmp.close();
        onReady();
      })
      .catch(() => {
        // Missing or refused: the night stays without a picture.
      });
  }

  /** The tide ended: the old picture is no longer seen. */
  settle(): void {
    this.drop(this.old);
    this.old = null;
  }

  /** A picture is fading in: the engine needs frames. */
  get fading(): boolean {
    return !!this.cur?.tex && this.cur.shown < 1;
  }

  step(now: number): void {
    const dt = this.last ? now - this.last : 0;
    this.last = now;
    const c = this.cur;
    if (c?.tex && c.shown < 1) c.shown = Math.min(1, c.shown + dt / GAME_COLORS.hero.fadeMs);
  }

  bind(): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + HERO_UNITS.uHero0);
    gl.bindTexture(gl.TEXTURE_2D, this.old?.tex ?? this.blank);
    gl.activeTexture(gl.TEXTURE0 + HERO_UNITS.uHero1);
    gl.bindTexture(gl.TEXTURE_2D, this.cur?.tex ?? this.blank);
    gl.activeTexture(gl.TEXTURE0);
  }

  /** Opacity, mip level and aspect of both pictures; where the fade into the night runs (px). */
  uniforms(H: number): Uniforms {
    const { opacity, fadeFrom, fadeTo } = GAME_COLORS.hero;
    const o = this.old?.tex ? opacity : 0;
    const c = this.cur?.tex ? opacity * this.cur.shown : 0;
    return {
      ...HERO_UNITS,
      uHeroK: [o, c, this.old?.lod ?? 0, this.cur?.lod ?? 0],
      uHeroA: [this.old?.aspect ?? 3, this.cur?.aspect ?? 3],
      uHeroM: [fadeFrom * H, fadeTo * H],
    };
  }

  private drop(h: Hero | null): void {
    if (h?.tex) this.gl.deleteTexture(h.tex);
    if (h) h.tex = null;
  }

  dispose(): void {
    this.drop(this.old);
    this.drop(this.cur);
    this.old = this.cur = null;
    if (this.blank) this.gl.deleteTexture(this.blank);
  }
}
