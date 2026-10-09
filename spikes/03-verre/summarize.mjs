// Merges captures/results.jsonl (frames + CPU of the tree) with captures/gpu.jsonl per measured step.
import { existsSync, readFileSync } from "node:fs";
const read = (f) => (existsSync(new URL(f, import.meta.url)) ? readFileSync(new URL(f, import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const res = read("./captures/results.jsonl"), gpu = read("./captures/gpu.jsonl");
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const mx = (a) => (a.length ? Math.max(...a) : NaN);
console.log(JSON.stringify(res.find((r) => r.kind === "env")));
console.log("label            Hz   p50    p95    p99    max  dropped(vs med / vs 279Hz)  CPU%avg/max  GPU3D%avg/max  RSS_MB");
for (const s of res.filter((r) => r.kind === "step")) {
  const cpu = res.filter((r) => r.kind === "cpu" && r.t >= s.start && r.t <= s.end);
  const g = gpu.filter((r) => r.t >= s.start && r.t <= s.end);
  console.log(
    `${s.label.padEnd(15)} ${s.hz_est.toFixed(0).padStart(4)} ${s.p50.toFixed(2).padStart(6)} ${s.p95.toFixed(2).padStart(6)} ${s.p99.toFixed(2).padStart(6)} ${s.max.toFixed(2).padStart(6)}  ` +
      `${String(s.dropped_vs_median).padStart(5)} / ${String(s.dropped_vs_279hz).padEnd(5)} of ${s.n}   ` +
      `${avg(cpu.map((r) => r.machine_pct)).toFixed(1)}/${mx(cpu.map((r) => r.machine_pct)).toFixed(1)}   ` +
      `${avg(g.map((r) => r.gpu3d)).toFixed(1)}/${mx(g.map((r) => r.gpu3d)).toFixed(1)}   ${mx(cpu.map((r) => r.rss_mb))}`,
  );
}
