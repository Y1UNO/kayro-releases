/**
 * The cursor as a soft light source (art direction `cursorLight`): where the pointer is, and a
 * level that fades in when it moves over the window and out (≈ 250 ms) when it leaves it.
 * Round 2b: a smoothed offset of the pointer from the window centre (−1…1, back to 0 when it
 * leaves), for the parallax of the particles (`matter.parallax`).
 */
export const FADE_MS = 250;
/** Time constant of the parallax offset (ms): the layers drift after the cursor, never jump. */
export const PARALLAX_MS = 450;

export class PointerLight {
  x = 0;
  y = 0;
  /** 0–1, fade included. */
  level = 0;
  /** Set by every move; the engine clears it once it has drawn. */
  moved = false;
  /** Smoothed offset from the window centre, −1…1 (parallax). */
  ox = 0;
  oy = 0;
  /** Parallax in use: the offset is smoothed (and asks for frames) only then. */
  parallax = false;
  private inside = false;
  private attached = false;

  private readonly onMove = (e: PointerEvent) => {
    this.x = e.clientX;
    this.y = e.clientY;
    this.inside = true;
    this.moved = true;
  };
  private readonly onOut = (e: MouseEvent) => {
    if (!e.relatedTarget) {
      this.inside = false;
      this.moved = true;
    }
  };
  private readonly onBlur = () => {
    this.inside = false;
    this.moved = true;
  };

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("mouseout", this.onOut);
    window.addEventListener("blur", this.onBlur);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("mouseout", this.onOut);
    window.removeEventListener("blur", this.onBlur);
    this.inside = false;
    this.level = 0;
    this.ox = this.oy = 0;
  }

  /** Advances the fade; true while it is still changing. */
  step(dt: number): boolean {
    const drift = this.parallax && this.drift(dt);
    const target = this.inside ? 1 : 0;
    if (this.level === target) return drift;
    const d = dt / FADE_MS;
    this.level = target > this.level ? Math.min(1, this.level + d) : Math.max(0, this.level - d);
    return true;
  }

  /** Moves the parallax offset towards the pointer (or the centre); true while it moves. */
  private drift(dt: number): boolean {
    const W = window.innerWidth || 1;
    const H = window.innerHeight || 1;
    const tx = this.inside ? (this.x / W) * 2 - 1 : 0;
    const ty = this.inside ? (this.y / H) * 2 - 1 : 0;
    if (Math.abs(tx - this.ox) < 1e-3 && Math.abs(ty - this.oy) < 1e-3) {
      this.ox = tx;
      this.oy = ty;
      return false;
    }
    const k = 1 - Math.exp(-dt / PARALLAX_MS);
    this.ox += (tx - this.ox) * k;
    this.oy += (ty - this.oy) * k;
    return true;
  }
}
