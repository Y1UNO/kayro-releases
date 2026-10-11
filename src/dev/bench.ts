// Frame-time bench of the dev pages (step 7; reused by the art direction workshop, step 12b).

export interface BenchResult {
  frames: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  over25ms: number;
  /** Frames longer than 1.5× the median frame (a frame missed at this refresh rate). */
  dropped: number;
  hz: number;
}

/** Sends ArrowRight / ArrowLeft at `keyHz` keys per second (30 = a held key, 0 = none) for `ms`, and records every frame time. */
export function runBench(ms: number, keyHz = 30): Promise<BenchResult> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let last = performance.now();
    const start = last;
    let dir = "ArrowRight";
    let sinceKey = 0;
    let steps = 0;
    const loop = (now: number) => {
      deltas.push(now - last);
      sinceKey += now - last;
      last = now;
      if (sinceKey >= 1000 / keyHz) {
        sinceKey = 0;
        if (++steps % Math.max(4, Math.round(keyHz * 1.3)) === 0)
          dir = dir === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
        window.dispatchEvent(new KeyboardEvent("keydown", { key: dir, bubbles: true }));
      }
      if (now - start < ms) requestAnimationFrame(loop);
      else {
        const sorted = [...deltas.slice(1)].sort((a, b) => a - b);
        const q = (p: number) =>
          sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
        resolve({
          frames: sorted.length,
          p50: q(0.5),
          p95: q(0.95),
          p99: q(0.99),
          max: sorted[sorted.length - 1] ?? 0,
          over25ms: sorted.filter((d) => d > 25).length,
          dropped: sorted.filter((d) => d > 1.5 * q(0.5)).length,
          hz: Math.round(1000 / (q(0.5) || 16.7)),
        });
      }
    };
    requestAnimationFrame(loop);
  });
}
