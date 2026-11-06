/**
 * Step 20 (Kysland): the island's bubbles and drops, filled, in the island's tone (light on a
 * dark screen, dark on a light one). Bubbles burst from it when it is forced through to another
 * screen; drops fall when it tears off the top edge and splash along it when it docks.
 *
 * They live **around the island** (coordinates from its centre) and follow it most of the way:
 * moving fast, they stream behind it like a wake, then fade. They never pile up on the window's
 * invisible edge: they fade out softly before reaching it. A few dozen at most, a canvas, and no
 * loop once the last one is gone.
 */

export interface Bubble {
  /** From the island's centre (logical pixels). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  life: number;
  /** Drops are smaller, denser, and fall; bubbles rise and shine. */
  drop: boolean;
  /** Upward pull (bubbles) or gravity (drops), px/s². */
  lift: number;
  /** Their own opacity (0–1), for depth. */
  alpha: number;
  /** How much of the island's motion they share (1: carried along, 0: left where they are). */
  follow: number;
}

export interface Point {
  x: number;
  y: number;
}

/** At most this many at once (older ones go first). */
export const MAX_BUBBLES = 80;
/** They fade out over this distance before the window's edge. */
export const EDGE_FADE = 70;

type Rand = () => number;
type Rgb = readonly [number, number, number];
const between = (rand: Rand, a: number, b: number) => a + (b - a) * rand();

export class Bubbles {
  list: Bubble[] = [];

  constructor(private rand: Rand = Math.random) {}

  private add(b: Omit<Bubble, "age">): void {
    this.list.push({ ...b, age: 0 });
    if (this.list.length > MAX_BUBBLES) this.list.splice(0, this.list.length - MAX_BUBBLES);
  }

  /** Forced through an edge: a stream behind (opposite `dir`), a burst ahead. */
  crossed(size: Point, dir: Point): void {
    const r = this.rand;
    const side = { x: -dir.y, y: dir.x };
    for (let i = 0; i < 36; i++) {
      const behind = i < 24;
      const way = behind ? -1 : 1;
      const spread = between(r, -1, 1);
      const speed = behind ? between(r, 60, 200) : between(r, 30, 120);
      this.add({
        x: between(r, -0.5, 0.5) * size.x + dir.x * way * size.x * 0.3,
        y: between(r, -0.5, 0.5) * size.y,
        vx: dir.x * way * speed + side.x * spread * 120,
        vy: dir.y * way * speed + side.y * spread * 120 - between(r, 10, 60),
        r: between(r, 2, behind ? 7 : 5),
        life: between(r, 0.9, 1.6),
        drop: false,
        lift: -between(r, 30, 90),
        alpha: between(r, 0.55, 0.95),
        follow: between(r, 0.72, 0.9),
      });
    }
  }

  /** Torn off: drops fall from where the top edge let go. */
  detached(size: Point): void {
    const r = this.rand;
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.add({
        x: side * between(r, 0.15, 0.55) * size.x,
        y: -size.y / 2 + between(r, 0, 8),
        vx: side * between(r, 10, 80),
        vy: between(r, 40, 170),
        r: between(r, 1.6, 4),
        life: between(r, 0.6, 1.05),
        drop: true,
        lift: 480,
        alpha: between(r, 0.75, 1),
        follow: between(r, 0.45, 0.7),
      });
    }
  }

  /** Docked: drops splash sideways along the edge. */
  touched(size: Point): void {
    const r = this.rand;
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.add({
        x: side * size.x * 0.45,
        y: -size.y / 2 + between(r, 2, 10),
        vx: side * between(r, 90, 260),
        vy: between(r, 10, 100),
        r: between(r, 1.2, 3.2),
        life: between(r, 0.45, 0.8),
        drop: true,
        lift: 360,
        alpha: between(r, 0.7, 1),
        follow: 1,
      });
    }
  }

  /** Advances by `dt` seconds while the island moves at `island` (px/s); true while any lives. */
  step(dt: number, island: Point = { x: 0, y: 0 }): boolean {
    for (const b of this.list) {
      b.age += dt;
      b.vy += b.lift * dt;
      b.vx *= Math.exp(-1.4 * dt);
      // Left behind by the share of the island's motion they do not follow.
      b.x += (b.vx - island.x * (1 - b.follow)) * dt;
      b.y += (b.vy - island.y * (1 - b.follow)) * dt;
    }
    this.list = this.list.filter((b) => b.age < b.life);
    return this.list.length > 0;
  }

  clear(): void {
    this.list = [];
  }

  /** Draws them around the island's `centre` in a window of `stage` size. */
  draw(
    ctx: CanvasRenderingContext2D,
    centre: Point,
    stage: { width: number; height: number },
    tone: Rgb,
    shine: Rgb,
  ): void {
    const fill = `rgb(${tone[0]} ${tone[1]} ${tone[2]})`;
    const light = `rgb(${shine[0]} ${shine[1]} ${shine[2]})`;
    for (const b of this.list) {
      const x = centre.x + b.x;
      const y = centre.y + b.y;
      const edge = Math.min(x, stage.width - x, y, stage.height - y);
      if (edge <= 0) continue;
      const t = b.age / b.life;
      const life = t < 0.12 ? t / 0.12 : 1 - ((t - 0.12) / 0.88) ** 1.6;
      const fade = Math.max(0, life) * Math.min(1, edge / EDGE_FADE) * b.alpha;
      const radius = b.r * (b.drop ? 1 - t * 0.5 : 0.75 + t * 0.4);
      ctx.globalAlpha = fade;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (!b.drop && radius > 2.2) {
        ctx.globalAlpha = fade * 0.75;
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.arc(x - radius * 0.32, y - radius * 0.32, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
