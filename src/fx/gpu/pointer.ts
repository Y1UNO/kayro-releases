/**
 * The cursor as a soft light source (art direction `cursorLight`): where the pointer is, and a
 * level that fades in when it moves over the window and out (≈ 250 ms) when it leaves it.
 */
export const FADE_MS = 250;

export class PointerLight {
  x = 0;
  y = 0;
  /** 0–1, fade included. */
  level = 0;
  /** Set by every move; the engine clears it once it has drawn. */
  moved = false;
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
  }

  /** Advances the fade; true while it is still changing. */
  step(dt: number): boolean {
    const target = this.inside ? 1 : 0;
    if (this.level === target) return false;
    const d = dt / FADE_MS;
    this.level = target > this.level ? Math.min(1, this.level + d) : Math.max(0, this.level - d);
    return true;
  }
}
