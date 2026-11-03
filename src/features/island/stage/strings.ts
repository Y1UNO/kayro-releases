import { N, STRINGS, type Ring } from "./diskArt";

/**
 * Kysland's « Disk »: its strings, a ring per instrument inside the disc. A hit plucks a ring (a
 * bump of speed at a random place), the bump runs round it both ways as a wave (each point pulled
 * by its neighbours, damped) and dies out. Drawn by `diskArt.ts`. Logical px, s.
 */
export class Strings {
  readonly rings: Ring[] = STRINGS.map(() => ({ u: new Float32Array(N), v: new Float32Array(N) }));

  constructor(private random: () => number = Math.random) {}

  /** Plucks ring `i` with `amp` px/s at a random place. */
  pluck(i: number, amp: number): void {
    const r = this.rings[i];
    if (!r) return;
    const c = Math.floor(this.random() * N);
    for (let k = -10; k <= 10; k++) {
      const j = (c + k + N) % N;
      r.v[j] = r.v[j]! + amp * Math.exp((-k * k) / 20);
    }
  }

  step(h: number): void {
    for (const { u, v } of this.rings) {
      for (let i = 0; i < N; i++) {
        const lap = u[(i + N - 1) % N]! + u[(i + 1) % N]! - 2 * u[i]!;
        v[i] = v[i]! + (7000 * lap - 40 * u[i]! - 2.2 * v[i]!) * h;
      }
      for (let i = 0; i < N; i++) u[i] = u[i]! + v[i]! * h;
    }
  }

  /** A wave still runs on one of them. */
  get moving(): boolean {
    return this.rings.some((r) => r.u.some((x) => Math.abs(x) > 0.2));
  }
}
