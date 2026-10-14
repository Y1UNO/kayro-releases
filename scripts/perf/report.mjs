// Kayro performance bench: medians per case and quality, a Markdown table, « before / after ».
import { readFileSync } from "node:fs";
import { r2 } from "./lib.mjs";

export const readJsonl = (file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

const med = (a) => {
  const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
/** « R1 éventail repos » (older sessions) and « R1 » both give « R1 ». */
const shortId = (id) => String(id).split(" ")[0];

/** Kept trials only: measured rows, focus kept from start to end, not marked discarded. */
export function aggregate(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (!r.cost || r.discarded || r.fgStart === false || r.fgEnd === false) continue;
    const k = shortId(r.id) + "|" + r.q;
    if (!groups.has(k)) groups.set(k, { title: r.title ?? r.id, rows: [] });
    groups.get(k).rows.push(r);
  }
  const out = new Map();
  for (const [k, g] of groups) {
    const f = g.rows.filter((r) => r.frames);
    const names = f[0]?.during?.map((d) => d.name) ?? [];
    out.set(k, {
      title: g.title,
      n: g.rows.length,
      p95: f.length ? Math.max(...f.map((r) => r.frames.p95)) : null,
      over8: f.map((r) => r.frames.over8),
      over16: f.map((r) => r.frames.over16 ?? null),
      max: f.length ? Math.max(...f.map((r) => r.frames.max)) : null,
      cpu: med(g.rows.map((r) => r.cost.cpu)),
      gpu: med(g.rows.map((r) => r.cost.gpuApp)),
      dwm: med(g.rows.map((r) => r.cost.gpuDwm)),
      mem: med(g.rows.map((r) => r.cost.memMB)),
      bgCpu: med(g.rows.map((r) => r.cost.cpuMachine - r.cost.cpu)),
      bgGpu: med(g.rows.map((r) => r.cost.gpuAll - r.cost.gpuApp - r.cost.gpuDwm)),
      pointer: f.some((r) => r.pointer) ? f.map((r) => r.pointer) : null,
      during: names.map((name, i) => ({
        name,
        occ: f.map((r) => r.during[i]?.occ),
        worst: f.map((r) => r.during[i]?.worstOcc),
        max: Math.max(...f.map((r) => r.during[i]?.max ?? 0)),
      })),
    });
  }
  return out;
}

const n1 = (x) => (x == null ? "—" : String(r2(x)).replace(".", ","));
const list = (a) => (a && a.length ? a.map((x) => (x == null ? "—" : x)).join(",") : "—");
const pair = (a, b) => (b === undefined ? n1(a) : `${n1(b)} → ${n1(a)}`);

/** One row per case and quality; with `before`, each value reads « before → after ». */
export function markdown(agg, before) {
  const lines = [
    "| Case | Qualité | p95 | > 8 ms (essais) | max | CPU % | GPU app % | dwm % | Mém. Mo | fond CPU / GPU |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  const during = [];
  for (const [k, a] of agg) {
    const [id, q] = k.split("|");
    const b = before?.get(k);
    const over8 = b ? `${list(b.over8)} → ${list(a.over8)}` : list(a.over8);
    lines.push(
      `| ${id} ${a.title.replace(/^\S+\s/, "")} | ${q} | ${pair(a.p95, b?.p95)} | ${over8} | ${pair(a.max, b?.max)} | ${pair(a.cpu, b?.cpu)} | ${pair(a.gpu, b?.gpu)} | ${pair(a.dwm, b?.dwm)} | ${pair(a.mem, b?.mem)} | ${n1(a.bgCpu)} / ${n1(a.bgGpu)} |`,
    );
    for (const d of a.during) {
      const bd = b?.during?.find((x) => x.name === d.name);
      during.push(
        `| ${id} ${d.name} | ${q} | ${list(d.occ)} | ${bd ? `${list(bd.worst)} → ` : ""}${list(d.worst)} | ${pair(d.max, bd?.max)} |`,
      );
    }
    if (a.pointer)
      lines.push(
        `|  ↳ pointeur (envoyés / reçus par s) | ${q} | ${a.pointer.map((p) => `${p.sentPerS} / ${p.gotPerS}`).join(" ; ")} | | | | | | | |`,
      );
  }
  if (during.length) {
    lines.push(
      "",
      "| Animation | Qualité | Occurrences | Pire / occ. (> 8 ms) | Max pendant |",
      "|---|---|---|---|---|",
      ...during,
    );
  }
  return lines.join("\n");
}
