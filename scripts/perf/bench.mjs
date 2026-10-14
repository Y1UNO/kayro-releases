// Kayro performance bench (step 13; reused by steps 14–17 and the audit). See README.md.
//   npm run perf -- [--block L|M|all] [--cases R1,I3,…] [--quality high,eco] [--trials 2]
//                   [--launches 3] [--dry] [--compare <results.jsonl>] [--trace <case>]
//                   [--memory 10] [--set key=value,…] [--keep-data]
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CASES, ensure, select } from "./cases.mjs";
import { BASE_LOOK, makeData, removeData, wantsArt, writeSettings } from "./data.mjs";
import * as L from "./lib.mjs";
import { aggregate, markdown, readJsonl } from "./report.mjs";
import {
  INVALIDATION_CATEGORY,
  invalidationSummary,
  SELECTOR_CATEGORY,
  selectorSummary,
  traceSummary,
  TRACE_CATEGORIES,
} from "./trace.mjs";

const args = parseArgs(process.argv.slice(2));
const DRY = !!args.dry;
const WIN_S = DRY ? 2 : 10;
const COST_S = DRY ? 3 : 10;
const TRIALS = DRY ? 1 : Number(args.trials ?? 2);
const QUALITIES = String(args.quality ?? "high,eco").split(",");
const BLOCK = String(args.block ?? (args.cases || args.trace ? "M" : "all"));
const OUT = join(
  L.ROOT,
  new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + (DRY ? "-dry" : ""),
);
const RESULTS = join(OUT, "results.jsonl");
const { sleep, now, say } = L;
const win = new L.Win();
const X = { s: null, w: null, K: null, at: null };
const rec = (o) =>
  appendFileSync(RESULTS, JSON.stringify({ at: new Date().toISOString(), ...o }) + "\n");

function parseArgs(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith("--")) continue;
    const k = a[i].slice(2);
    o[k] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
  }
  return o;
}

// ---------- one trial: frames (probe on) then cost (probe off), scenario running all along ----------
function runScenario(c, fn) {
  const ctx = { stop: false, n: 0 };
  ctx.wait = async (ms) => {
    const t = now();
    while (!ctx.stop && now() - t < ms) await sleep(Math.min(25, ms));
  };
  ctx.done = (async () => {
    try {
      while (!ctx.stop) {
        await fn(X, ctx);
        ctx.n++;
      }
    } catch (e) {
      ctx.error = e.message;
      say("erreur de scénario", c.id, e.message);
    }
  })();
  return ctx;
}
async function trial(c, q, t) {
  const page = () => (c.page === "widget" ? X.w : X.s);
  const fg0 = await win.ask("fg " + X.K.pid);
  const sc = c.scenario ? runScenario(c, c.scenario) : null;
  await sleep(c.settle ?? 1500);
  let frames = null;
  let during = null;
  let pointer = null;
  let fgEnd = null;
  if (!c.costOnly) {
    const sent0 = sc?.sent ?? 0;
    await L.probeStart(page(), c.probe ?? {});
    await sleep(WIN_S * 1000);
    const r = await L.probeStop(page());
    fgEnd = await win.ask("fgpid");
    frames = { ...L.frameStats(r.t), focus: r.focus };
    during = (c.during ?? []).map((d) => ({
      name: d.name,
      ...L.duringStats(r.t, r.marks, d.dur, (l) => d.re.test(l)),
    }));
    if (c.id === "I9")
      pointer = {
        sentPerS: Math.round(((sc?.sent ?? 0) - sent0) / WIN_S),
        gotPerS: Math.round(r.pm / WIN_S),
        frames: frames.n,
      };
    if (c.probe?.opacity) frames.opacity = slowFramesOpacity(r);
  }
  const cost = await win.ask(`cost ${X.K.pid} ${COST_S}`);
  if (sc) {
    sc.stop = true;
    await sc.done;
  }
  const row = {
    id: c.id,
    title: c.title,
    q,
    t,
    fgStart: fg0.ok,
    fgEnd: fgEnd ? fgEnd.fg === X.K.pid : null,
    stealer: fg0.ok && (!fgEnd || fgEnd.fg === X.K.pid) ? undefined : (fgEnd?.fgName ?? fg0.fgName),
    frames,
    during,
    pointer,
    cost,
    cycles: sc?.n,
    error: sc?.error,
  };
  rec(row);
  const f = frames
    ? `p95 ${frames.p95} max ${frames.max} >8 ${frames.over8} >16 ${frames.over16}`
    : "(coût seul)";
  const d = during?.map((x) => `${x.name}: pire/occ ${x.worstOcc} max ${x.max}`).join(" ; ") ?? "";
  const p = pointer ? `pointeur ${pointer.sentPerS}/s envoyés, ${pointer.gotPerS}/s reçus` : "";
  say(
    `${c.id} ${q} #${t}`,
    f,
    `cpu ${cost.cpu} gpu ${cost.gpuApp} dwm ${cost.gpuDwm} mem ${cost.memMB}`,
    d,
    p,
    row.stealer ? "FOCUS → " + row.stealer : "",
  );
  return row;
}
/** Passages: the page's opacity at each frame slower than 8 ms (0 = in the dark). */
function slowFramesOpacity(r) {
  const out = [];
  for (let i = 1; i < r.t.length; i++)
    if (r.t[i] - r.t[i - 1] > 8)
      out.push([L.r2(r.t[i] - r.t[i - 1]), r.ext[i - 1]?.[1] ?? null, r.ext[i]?.[1] ?? null]);
  return out;
}
const lostFocus = (r) => r.fgStart === false || r.fgEnd === false;
function unstable(a, b) {
  const cpu =
    Math.abs(a.cost.cpu - b.cost.cpu) > Math.max(0.3, 0.3 * Math.min(a.cost.cpu, b.cost.cpu));
  if (!a.frames) return cpu;
  return (
    cpu ||
    Math.abs(a.frames.p95 - b.frames.p95) > 0.3 ||
    Math.abs(a.frames.over8 - b.frames.over8) > 2 ||
    [a, b].some((r) => r.frames.p95 > 5.4 || r.during?.some((d) => d.worstOcc > 1))
  );
}
async function measure(c, q) {
  const rows = [];
  let redo = 0;
  for (let t = 1; t <= TRIALS; t++) {
    const row = await trial(c, q, t);
    if (lostFocus(row) && redo < 2) {
      redo++;
      rec({ id: c.id, q, t, discarded: "focus perdu", stealer: row.stealer });
      t--;
      continue;
    }
    rows.push(row);
  }
  if (!DRY && rows.length === 2 && unstable(rows[0], rows[1])) rows.push(await trial(c, q, 3));
}

// ---------- block M ----------
/** `--set themeTransition=direct,cardHover=simple`: settings forced on every case (diagnosis). */
const FORCED = Object.fromEntries(
  String(args.set ?? "")
    .split(",")
    .filter(Boolean)
    .map((kv) => kv.split("="))
    .map(([k, v]) => [k, v === "true" ? true : v === "false" ? false : v]),
);
const BASE = { ...BASE_LOOK, ...FORCED };
let current = {};
async function apply(patch) {
  const diff = Object.fromEntries(Object.entries(patch).filter(([k, v]) => current[k] !== v));
  if (!Object.keys(diff).length) return;
  await X.s.settings(diff);
  Object.assign(current, diff);
  await sleep(800);
}
async function startApp() {
  X.K = L.launch({ cdp: true });
  X.s = await L.connect();
  await L.ready(X.s);
  await sleep(7000); // the opening plays, then the fan
  X.at = null;
  current = {};
  await win.ask("fg " + X.K.pid);
}
async function hiddenCost(q) {
  await X.s.invoke("window_hide");
  await sleep(3000);
  const cost = await win.ask(`cost ${X.K.pid} ${COST_S}`);
  rec({ id: "R10", title: "Hub masqué (coût seul)", q, t: 1, cost });
  say("R10", q, JSON.stringify(cost));
  L.launch({ cdp: true }); // a second launch shows the hidden window again
  await sleep(2000);
  X.s.close();
  X.s = await L.connect();
  await L.ready(X.s);
  await win.ask("fg " + X.K.pid);
  X.at = null;
}
async function blockM(cases) {
  await startApp();
  for (const q of QUALITIES) {
    const list = cases.filter((c) => (c.qualities ?? ["high", "eco"]).includes(q));
    if (!list.length) continue;
    say("=== qualité", q);
    await apply({ ...BASE, quality: q });
    for (const c of list) {
      await apply({ ...BASE, quality: q, ...c.settings });
      if (c.at === "hidden") {
        await ensure(X, "carousel");
        await hiddenCost(q);
        continue;
      }
      await ensure(X, c.at);
      await c.before?.(X);
      await measure(c, q);
      await c.after?.(X);
    }
  }
  await ensure(X, "carousel");
  await apply({ ...BASE, quality: "high" });
  rec({ id: "quit M", quit: await L.quit(X.K.pid) });
  X.s.close();
}

// ---------- block L: launches (opening frames, --quit) ----------
async function blockL() {
  const n = Number(args.launches ?? (DRY ? 1 : 3));
  // A first launch without debugging: --quit of an ordinary instance.
  const plain = [{ q: QUALITIES[0], cdp: false }];
  const plan = plain.concat(
    QUALITIES.flatMap((q) =>
      Array.from({ length: n }, (_, i) => ({ q, cdp: true, twice: i === n - 1 })),
    ),
  );
  for (const [i, st] of plan.entries()) {
    writeSettings({ quality: st.q });
    const since = new Date().toISOString();
    X.K = L.launch({ cdp: st.cdp });
    const row = { id: "L" + (i + 1), q: st.q, cdp: st.cdp };
    if (st.cdp) {
      X.s = await L.connect();
      await L.probeStart(X.s, { opening: true, early: true });
      await sleep(7000);
      row.open = openingStats(await L.probeStop(X.s));
      row.fg = (await win.ask("fg " + X.K.pid)).ok;
    } else await sleep(7500);
    row.quit = await L.quit(X.K.pid, { twice: !!st.twice });
    X.s?.close();
    X.s = null;
    await sleep(600);
    const lines = L.logSince(since);
    row.quitPath = lines.some((l) => /leaving directly/.test(l))
      ? "filet"
      : lines.some((l) => /the event loop ended/.test(l))
        ? "boucle"
        : "?";
    rec(row);
    say(
      row.id,
      st.q,
      st.cdp ? "CDP" : "normal",
      row.open
        ? `pulsation >8 ${row.open.pulse?.over8} max ${row.open.pulse?.max} ; ouverture >8 ${row.open.opening?.over8} max ${row.open.opening?.max}`
        : "",
      `--quit ${row.quit.ms} ms (${row.quitPath})`,
    );
    await sleep(1500);
  }
}
function openingStats(r) {
  const bg = r.ext.filter((e) => e[2]);
  const wave = r.ext.find((e) => e[1] && Number(e[1]) > 0);
  const out = { all: L.frameStats(r.t) };
  if (!bg.length) return out;
  const a = bg[0][0];
  out.opening = {
    ...L.duringStats(r.t, [[a, "o"]], bg[bg.length - 1][0] - a),
    ms: Math.round(bg[bg.length - 1][0] - a),
  };
  // Eco has no wave: the ringOut comes at the same instant of the timeline (≈ 1 770 ms).
  const p = wave ? wave[0] : a + 1772;
  out.pulse = L.duringStats(r.t, [[p, "p"]], 900);
  return out;
}

// ---------- memory over repeated theme changes (does it come back down?) ----------
async function memoryRun(count) {
  const q = QUALITIES[0];
  await startApp();
  await apply({ ...BASE, quality: q });
  await ensure(X, "settings:Thèmes");
  await sleep(5000);
  const mem = async () => (await win.ask("mem " + X.K.pid)).memMB;
  const base = await mem();
  const after = [];
  for (let i = 0; i < count; i++) {
    await X.s.clickText(i % 2 ? "Thème Lavande-pêche" : "Thème Bleu-gris", "[role=dialog]");
    await sleep(3000);
    after.push(await mem());
  }
  await sleep(20000);
  const rested = await mem();
  rec({ id: "MEM", q, count, base, after, rested });
  say(
    `mémoire ${q} : base ${base} Mo ; 3 s après chaque changement ${after.join(" / ")} ; 20 s après le dernier ${rested} Mo`,
  );
  await ensure(X, "carousel");
  rec({ id: "quit MEM", quit: await L.quit(X.K.pid) });
}

// ---------- trace of one occurrence (CDP Tracing: a timeline, not a capture) ----------
async function trace(id) {
  const c = CASES.find((x) => x.id.toUpperCase() === String(id).toUpperCase());
  if (!c?.scenario) throw new Error("--trace wants a case with a scenario: " + id);
  const q = QUALITIES[0];
  await startApp();
  await apply({ ...BASE, quality: q, ...c.settings });
  await ensure(X, c.at);
  const s = c.page === "widget" ? X.w : X.s;
  const events = [];
  s.on("Tracing.dataCollected", (p) => events.push(...p.value));
  const complete = new Promise((r) => s.on("Tracing.tracingComplete", r));
  const categories = [
    TRACE_CATEGORIES,
    args.invalidations ? INVALIDATION_CATEGORY : "",
    args["selector-stats"] ? SELECTOR_CATEGORY : "",
  ]
    .filter(Boolean)
    .join(",");
  await s.send("Tracing.start", { categories, transferMode: "ReportEvents" });
  await sleep(300);
  const ctx = { stop: false, wait: (ms) => sleep(ms) };
  await c.scenario(X, ctx); // one cycle
  await sleep(500);
  await s.send("Tracing.end");
  await complete;
  const file = join(OUT, `trace-${c.id}-${q}.json`);
  writeFileSync(file, JSON.stringify({ traceEvents: events }));
  const parts = [traceSummary(events)];
  if (args.invalidations) parts.push(invalidationSummary(events));
  if (args["selector-stats"]) parts.push(selectorSummary(events));
  const sum = parts.join(String.fromCharCode(10));
  writeFileSync(join(OUT, `trace-${c.id}-${q}.txt`), sum);
  console.log(sum);
  say("trace :", file, "(chrome://tracing, Perfetto ou l'onglet Performance)");
  await c.after?.(X);
  rec({ id: "quit trace", quit: await L.quit(X.K.pid) });
}

// ---------- session ----------
async function main() {
  if ((await L.kayroPids()).length)
    throw new Error("Kayro est ouvert : le quitter d'abord (Kayro.exe --quit).");
  mkdirSync(OUT, { recursive: true });
  const screen = await win.ask("screen");
  if (args.exe) L.setExe(String(args.exe)); // A/B of two builds (README)
  rec({ id: "écran", screen, exe: L.EXE });
  const n = makeData(QUALITIES[0], screen, wantsArt(args)); // step 14: pictures for G cases
  say("dossier de test :", n, "apps ; résultats :", OUT);
  await win.ask("awake on");
  if (args.trace) return trace(args.trace);
  if (args.memory) return memoryRun(Number(args.memory) || 10);
  if (BLOCK === "L" || BLOCK === "all") await blockL();
  if (BLOCK === "M" || BLOCK === "all") {
    const cases = select(args.cases);
    if (!cases.length) throw new Error("aucune case : " + args.cases);
    await blockM(cases);
  }
  const agg = aggregate(readJsonl(RESULTS));
  const before = args.compare ? aggregate(readJsonl(String(args.compare))) : undefined;
  writeFileSync(join(OUT, "report.md"), markdown(agg, before) + "\n");
  say("rapport :", join(OUT, "report.md"));
}

try {
  await main();
} catch (e) {
  say("ERREUR", e.stack);
  rec({ id: "ERREUR", error: e.stack });
  for (const pid of await L.kayroPids())
    say("--quit après erreur", JSON.stringify(await L.quit(pid)));
} finally {
  await win.ask("awake off");
  await win.close();
  if (!args["keep-data"]) removeData();
  process.exit(0);
}
