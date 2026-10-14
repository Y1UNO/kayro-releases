// Kayro performance bench: what a trace says about the long frames of one occurrence.
// Renderer main threads (CrRendererMain): every task longer than 8 ms, the work under it (script,
// style, layout, view transition…) totalled by name, and the gaps between main frames.

export const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "blink",
  "cc",
  "v8.execute",
  "toplevel",
].join(",");

/** Scheduler wrappers: they hold the work, they are not the work. */
const WRAPPERS = new Set(["RunTask", "ThreadControllerImpl::RunTask", "Edge_RunTask"]);
const ms = (us) => (us / 1000).toFixed(1);

export function traceSummary(events) {
  const mains = new Set(
    events
      .filter((e) => e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain")
      .map((e) => `${e.pid}:${e.tid}`),
  );
  const lines = [];
  for (const key of mains) {
    const evs = events.filter((e) => e.ph === "X" && e.dur != null && `${e.pid}:${e.tid}` === key);
    if (!evs.length) continue;
    evs.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const t0 = evs[0].ts;
    const long = evs.filter((e) => e.name === "ThreadControllerImpl::RunTask" && e.dur > 8000);
    lines.push(`Fil principal ${key} : ${long.length} tâche(s) > 8 ms`);
    for (const task of long) {
      const inside = evs.filter(
        (e) => !WRAPPERS.has(e.name) && e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur,
      );
      const sums = new Map();
      for (const e of inside) sums.set(e.name, (sums.get(e.name) ?? 0) + e.dur);
      const top = [...sums].sort((a, b) => b[1] - a[1]).slice(0, 8);
      const fn = inside
        .filter((e) => e.name === "FunctionCall" && e.args?.data?.functionName)
        .map((e) => `${e.args.data.functionName}:${e.args.data.lineNumber}`);
      lines.push(
        `  à +${ms(task.ts - t0)} ms : ${ms(task.dur)} ms — ${top.map(([n, d]) => `${n} ${ms(d)}`).join(", ")}` +
          (fn.length ? ` — script : ${[...new Set(fn)].slice(0, 4).join(", ")}` : ""),
      );
    }
    const frames = evs.filter((e) => e.name === "ProxyMain::BeginMainFrame").map((e) => e.ts);
    const gaps = [];
    for (let i = 1; i < frames.length; i++)
      if (frames[i] - frames[i - 1] > 8000)
        gaps.push(`+${ms(frames[i] - t0)}:${ms(frames[i] - frames[i - 1])}`);
    lines.push(`  intervalles entre images > 8 ms : ${gaps.join("  ") || "aucun"}`);
  }
  return lines.join("\n");
}

/** With `--invalidations`: what was invalidated, by reason and element, the most frequent first. */
export const INVALIDATION_CATEGORY = "disabled-by-default-devtools.timeline.invalidationTracking";

export function invalidationSummary(events) {
  const counts = new Map();
  for (const e of events) {
    if (!/InvalidationTracking$/.test(e.name)) continue;
    const d = e.args?.data ?? {};
    const what = d.changedAttribute
      ? `attribut ${d.changedAttribute}`
      : d.changedClass
        ? `classe ${d.changedClass}`
        : d.changedPseudo
          ? `pseudo ${d.changedPseudo}`
          : d.changedId
            ? `id ${d.changedId}`
            : (d.reason ?? "?");
    const k = `${e.name.replace("InvalidationTracking", "")} · ${what} · ${d.nodeName ?? "?"}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 25);
  return ["Invalidations (les plus fréquentes) :", ...top.map(([k, n]) => `  ${n} × ${k}`)].join(
    "\n",
  );
}

/** With `--selector-stats`: the CSS selectors that cost the most during style recalcs. */
export const SELECTOR_CATEGORY = "disabled-by-default-blink.debug";

export function selectorSummary(events) {
  const by = new Map();
  for (const e of events) {
    const timings = e.name === "SelectorStats" ? e.args?.selector_stats?.selector_timings : null;
    for (const t of timings ?? []) {
      const a = by.get(t.selector) ?? { us: 0, attempts: 0, matches: 0 };
      a.us += t.elapsed ?? 0;
      a.attempts += t.match_attempts ?? 0;
      a.matches += t.match_count ?? 0;
      by.set(t.selector, a);
    }
  }
  const top = [...by].sort((a, b) => b[1].us - a[1].us).slice(0, 20);
  return [
    "Sélecteurs les plus coûteux (µs, essais, correspondances) :",
    ...top.map(
      ([s, a]) => `  ${Math.round(a.us)} µs · ${a.attempts} · ${a.matches} · ${s.slice(0, 120)}`,
    ),
  ].join("\n");
}
