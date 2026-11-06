import { clamp, lerp, Sp } from "./motion";
import type { Uniforms } from "./uniforms";

/**
 * Kysland's island leaving and coming home (the lab's Île): the neck of five balls between the
 * island and its drop. Stretched, it thins in its middle like honey until it breaks; then its
 * upper pieces go back up into the island, the lower ones join the ball, the middle one falls
 * into it as a little satellite drop. Coming home, three of them make the liquid bridge the ball
 * empties through. Logical px, s.
 */
export class Neck {
  readonly N = Array.from({ length: 5 }, () => ({ x: new Sp(), y: new Sp(), r: new Sp(0) }));

  /**
   * Held between the island's bottom `top` and the ball (`bx`, `by`, radius `bR`): thinning as it
   * stretches; true once it breaks (stretched past 1.05 × 0.3 H).
   */
  stretch(
    top: number,
    ix: number,
    bx: number,
    by: number,
    bR: number,
    H: number,
    s: number,
  ): boolean {
    const len = by - bR * 0.75 - top;
    const st = clamp(len / (H * 0.3), 0, 1.2);
    this.N.forEach((n, i) => {
      const f = (i + 1) / 6;
      n.x.set(lerp(ix, bx, f));
      n.y.set(top + len * f);
      const thin = 1 - 0.62 * Math.sin(Math.PI * f) * Math.min(1, st);
      n.r.set(H * 0.034 * s * thin * (st > 1 ? Math.max(0.3, 1 - (st - 1) * 2) : 1));
    });
    if (st < 1.05) return false;
    this.N[2]!.y.v = H * 0.6;
    return true;
  }

  /** Broken: up into the island (at `ix`, `bot`), or down into the ball. */
  settle(
    h: number,
    ix: number,
    bot: number,
    bx: number,
    by: number,
    bR: number,
    H: number,
    s: number,
  ): void {
    this.N.forEach((n, i) => {
      if (i < 2) {
        n.x.to(ix, 200, 0.6, h);
        n.y.to(bot, 200, 0.6, h);
        n.r.to(0, 90, 0.8, h);
      } else if (i > 2) {
        n.x.to(bx, 200, 0.6, h);
        n.y.to(by, 200, 0.6, h);
        n.r.to(0, 60, 0.8, h);
      } else {
        n.x.to(bx, 35, 0.45, h);
        n.y.to(by, 35, 0.45, h);
        const inside = Math.hypot(n.x.x - bx, n.y.x - by) < bR * 0.8;
        n.r.to(inside ? 0 : H * 0.016 * s, inside ? 80 : 200, 0.8, h);
      }
    });
  }

  /** The touch coming home: a bridge of three between the island's bottom and the ball. */
  bridge(ix: number, bot: number, by: number, H: number, s: number): void {
    this.N.forEach((n, i) => {
      if (i >= 3) return;
      const f = (i + 1) / 4;
      n.x.set(ix);
      n.y.set(lerp(bot, by, f));
      n.r.set(H * 0.03 * s);
    });
  }

  /** The bridge emptying into the island. */
  drink(h: number, ix: number, bot: number, by: number): void {
    this.N.forEach((n, i) => {
      const f = (i + 1) / 4;
      n.x.to(ix, 200, 0.7, h);
      n.y.to(lerp(bot, by, f), 200, 0.7, h);
      n.r.to(0, 100, 0.8, h);
    });
  }

  /** All of it gone. */
  shrink(h: number): void {
    for (const n of this.N) n.r.to(0, 120, 0.8, h);
  }

  clear(): void {
    for (const n of this.N) n.r.set(0);
  }

  /** Its balls into the shader's (from `n`); the count after them. */
  fill(U: Uniforms, n: number): number {
    for (const o of this.N) {
      if (o.r.x < 0.4) continue;
      U.balls.set([o.x.x, o.y.x, o.r.x, 1.2], n * 4);
      n++;
    }
    return n;
  }

  /** `b` grown to hold it (with `pad`). */
  reach(b: { x0: number; y0: number; x1: number; y1: number }, pad: number): void {
    for (const n of this.N) {
      if (n.r.x < 0.4) continue;
      b.x0 = Math.min(b.x0, n.x.x - n.r.x - pad);
      b.y0 = Math.min(b.y0, n.y.x - n.r.x - pad);
      b.x1 = Math.max(b.x1, n.x.x + n.r.x + pad);
      b.y1 = Math.max(b.y1, n.y.x + n.r.x + pad);
    }
  }
}
