/**
 * Posters as textures of the glass engine (round 2b, art direction `posterGlass`): the glass of a
 * carousel card refracts and reflects its real poster. The picture is the one the page already
 * shows (same URL, served from the browser's cache: nothing is copied elsewhere or sent anywhere),
 * decoded off the main thread (`createImageBitmap`), at most 512 × 720.
 *
 * One texture per poster URL in use, at most `MAX_POSTERS` (texture units 1…6 of the glass pass);
 * a texture no visible card has used for RELEASE_FRAMES drawn frames is deleted. At most one upload
 * per frame. A poster that cannot be loaded (missing, refused by CORS…) is remembered as failed:
 * its card keeps the DOM <img>.
 */
export const MAX_POSTERS = 6;
export const RELEASE_FRAMES = 30;
const MAX_W = 512;
const MAX_H = 720;

/** Decodes a poster; rejects if it cannot be used as a texture. */
export type PosterLoader = (url: string) => Promise<ImageBitmap>;

interface Slot {
  url: string;
  tex: WebGLTexture;
  aspect: number;
  unused: number;
}

export const loadPoster: PosterLoader = async (url) => {
  const img = new Image();
  // A poster from another origin (`kayro-art`, step 14) must allow it, or WebGL refuses it.
  if (new URL(url, location.href).origin !== location.origin) img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const k = Math.min(1, MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
  return createImageBitmap(img, {
    resizeWidth: Math.max(1, Math.round(img.naturalWidth * k)),
    resizeHeight: Math.max(1, Math.round(img.naturalHeight * k)),
    resizeQuality: "high",
  });
};

export class PosterTextures {
  private readonly slots: (Slot | null)[] = Array.from({ length: MAX_POSTERS }, () => null);
  private readonly pending = new Map<string, ImageBitmap>();
  private readonly loading = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly used = new Set<number>();
  private disposed = false;
  /** How many textures may be alive (art direction, ≤ MAX_POSTERS). */
  limit = MAX_POSTERS;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly load: PosterLoader = loadPoster,
  ) {}

  /** Starts a frame: nothing used yet. */
  begin(): void {
    this.used.clear();
  }

  /** Texture slot of this poster (0…5), or −1 while it loads, failed or no slot is free. */
  slotFor(url: string): number {
    const i = this.slots.findIndex((s) => s?.url === url);
    if (i >= this.limit) return -1; // about to be freed (limit lowered)
    if (i >= 0) {
      this.used.add(i);
      return i;
    }
    if (!this.failed.has(url) && !this.loading.has(url) && !this.pending.has(url)) {
      this.loading.add(url);
      this.load(url).then(
        (bmp) => {
          this.loading.delete(url);
          if (this.disposed) bmp.close();
          else this.pending.set(url, bmp);
        },
        () => {
          this.loading.delete(url);
          this.failed.add(url);
        },
      );
    }
    return -1;
  }

  aspect(slot: number): number {
    return this.slots[slot]?.aspect ?? 1;
  }

  /** Ends a frame: frees what nobody uses any more, uploads one decoded poster. True = uploaded. */
  end(): boolean {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s) continue;
      s.unused = this.used.has(i) ? 0 : s.unused + 1;
      if (s.unused > RELEASE_FRAMES || i >= this.limit) this.free(i);
    }
    for (const [url, bmp] of this.pending) {
      const free = this.slots.findIndex((s, i) => s === null && i < this.limit);
      if (free < 0) return false; // wait: a slot frees up when a card leaves
      this.pending.delete(url);
      const ok = this.upload(free, url, bmp);
      bmp.close();
      if (!ok) this.failed.add(url);
      return ok;
    }
    return false;
  }

  /** Binds the live textures to units 1…MAX_POSTERS (unit 0 = background). */
  bind(): void {
    const gl = this.gl;
    for (let i = 0; i < MAX_POSTERS; i++) {
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.slots[i]?.tex ?? null);
    }
    gl.activeTexture(gl.TEXTURE0);
  }

  /** Number of live textures (tests, journal). */
  get count(): number {
    return this.slots.filter(Boolean).length;
  }

  dispose(): void {
    this.disposed = true;
    for (let i = 0; i < this.slots.length; i++) this.free(i);
    for (const bmp of this.pending.values()) bmp.close();
    this.pending.clear();
  }

  private free(i: number): void {
    const s = this.slots[i];
    if (!s) return;
    this.gl.deleteTexture(s.tex);
    this.slots[i] = null;
  }

  private upload(i: number, url: string, bmp: ImageBitmap): boolean {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) return false;
    gl.activeTexture(gl.TEXTURE1 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    } catch {
      // SecurityError: a cross-origin picture without CORS. Its card keeps the DOM image.
      gl.deleteTexture(tex);
      gl.activeTexture(gl.TEXTURE0);
      return false;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.activeTexture(gl.TEXTURE0);
    this.slots[i] = { url, tex, aspect: bmp.width / Math.max(1, bmp.height), unused: 0 };
    return true;
  }
}
