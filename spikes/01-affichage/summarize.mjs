// Usage: node summarize.mjs [from-line]  -> p50/p95/max of paint latencies, focus and key counts.
import { readFileSync } from "node:fs";
const from = Number(process.argv[2] ?? 0);
const rows = readFileSync(new URL("./captures/results.jsonl", import.meta.url), "utf8")
  .split("\n").filter(Boolean).slice(from).map((l) => JSON.parse(l));
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
const paints = rows.filter((r) => r.kind === "paint");
const ms = paints.map((r) => r.ms);
const show = rows.filter((r) => r.kind === "rust_show").map((r) => r.ms);
console.log(`paints=${paints.length} focused=${paints.filter((r) => r.focused).length}`);
console.log(`press->paint ms: p50=${q(ms, .5)?.toFixed(1)} p95=${q(ms, .95)?.toFixed(1)} max=${Math.max(...ms).toFixed(1)}`);
console.log(`rust show()+set_focus() ms: p50=${q(show, .5)?.toFixed(1)} max=${Math.max(...show).toFixed(1)}`);
console.log(`sources: ${JSON.stringify(paints.reduce((a, r) => ((a[r.source] = (a[r.source] ?? 0) + 1), a), {}))}`);
console.log(`F24 keydown received: ${rows.filter((r) => r.kind === "key").length}`);
