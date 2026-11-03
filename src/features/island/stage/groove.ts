import type { Pulse } from "./beat";
import type { FigureKind } from "./figures";
import type { Sv } from "./motion";

/**
 * Kysland's « Dancing »: how the drops answer the music, this frame. Every beat the ink breathes
 * out from its middle (more on the bar's first beat, more when the bass is strong and the song
 * lively); the bass swells drops and shakes them; the snare claps the mass (squeezed from the
 * sides, pushed up and down); the hi-hats make a few drops shimmer; a crash bursts it all out
 * before it gathers again. Impulses only: each drop's own springs bring it back. Logical px.
 */

export interface Grooving {
  x: Sv;
  y: Sv;
  pop: Sv;
  jx: Sv;
  jy: Sv;
}

export function groove(
  blobs: readonly Grooving[],
  p: Pulse,
  kind: FigureKind,
  R: number,
  random: () => number = Math.random,
): void {
  const n = blobs.length;
  if (!n || !(p.beat || p.kick || p.snare || p.hat || p.crash)) return;
  let [cx, cy] = [0, 0];
  for (const b of blobs) [cx, cy] = [cx + b.x.x / n, cy + b.y.x / n];
  const L = Math.max(0.25, p.lift[0] ?? 0);
  const lively = 0.6 + 0.8 * p.energy;
  /** Pushes each drop away from the middle (inner ones less), `v` px/s. */
  const out = (v: number) => {
    for (const b of blobs) {
      const [dx, dy] = [b.x.x - cx, b.y.x - cy];
      const d = Math.hypot(dx, dy) || 1;
      const k = (v * Math.min(1, d / (0.5 * R))) / d;
      b.jx.v += dx * k;
      b.jy.v += dy * k;
    }
  };
  if (p.beat) out(R * (1.1 + 2.2 * L) * (p.bar === 0 ? 1.35 : 1) * lively);
  if (p.kick) {
    const heart = kind === "heart";
    const jit = (heart ? 3 : 1.3) * R * lively;
    blobs.forEach((b, i) => {
      if (heart || (i + p.bar) % 3 === 0) b.pop.v += (heart ? 2.2 : 1.8) * (0.6 + 0.8 * L);
      b.jx.v += (random() - 0.5) * jit;
      b.jy.v += (random() - 0.5) * jit;
    });
  }
  if (p.snare) {
    for (const b of blobs) {
      b.jx.v -= (b.x.x - cx) * 1.6 * lively;
      b.jy.v += (b.y.x - cy) * 1.1 * lively;
    }
  }
  if (p.hat) {
    for (let k = 0; k < 3; k++) blobs[Math.floor(random() * n)]!.pop.v += 0.9;
  }
  if (p.crash) {
    out(3.2 * R * lively);
    for (const b of blobs) b.pop.v += 2.5;
  }
}
