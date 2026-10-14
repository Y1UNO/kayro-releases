// Kayro performance bench: shared helpers (paths, the production exe, CDP, the frame probe, stats).
// No personal data: paths come from the repository and the system temp folder; the exe only ever
// sees the bench's own data folder (APPDATA redirected), recreated at each session.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, "..", "..");
export const EXE = join(REPO, "target", "release", "Kayro.exe");
export const ROOT = join(tmpdir(), "kayro-perf");
/** APPDATA given to the exe; its data folder is `<APPDATA_TEST>/Kayro`. */
export const APPDATA_TEST = join(ROOT, "appdata");
export const DATA = join(APPDATA_TEST, "Kayro");
export const CDP_PORT = 9222;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const now = () => performance.now();
export const say = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

// ---------- Windows helper (one persistent PowerShell, one JSON line per command) ----------
export class Win {
  constructor() {
    this.p = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(HERE, "win.ps1")],
      {
        stdio: ["pipe", "pipe", "inherit"],
      },
    );
    this.queue = [];
    createInterface({ input: this.p.stdout }).on("line", (l) => {
      const q = this.queue.shift();
      if (!q) return;
      try {
        q.res(JSON.parse(l));
      } catch {
        q.res({ error: "bad line", line: l });
      }
    });
  }
  ask(line) {
    return new Promise((res) => {
      this.queue.push({ res });
      this.p.stdin.write(line + "\n");
    });
  }
  async close() {
    await this.ask("quit");
  }
}

// ---------- the exe ----------
export function launch({ cdp = true, args = [] } = {}) {
  const env = { ...process.env, APPDATA: APPDATA_TEST };
  if (cdp) env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = `--remote-debugging-port=${CDP_PORT}`;
  else delete env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS;
  const child = spawn(EXE, args, { env, detached: true, stdio: "ignore" });
  child.unref();
  return { pid: child.pid, t0: now() };
}
export function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
/** `Kayro.exe --quit` (same data folder); waits for the instance to end. Never kills anything. */
export async function quit(pid, { timeoutMs = 15000, twice = false } = {}) {
  const t0 = now();
  const q = launch({ cdp: false, args: ["--quit"] });
  const q2 = twice ? launch({ cdp: false, args: ["--quit"] }) : null;
  while (alive(pid) && now() - t0 < timeoutMs) await sleep(10);
  const ms = Math.round(now() - t0);
  const t1 = now();
  while ((alive(q.pid) || (q2 && alive(q2.pid))) && now() - t1 < 5000) await sleep(20);
  return { ms, ended: !alive(pid) };
}
export function kayroPids() {
  return new Promise((res) => {
    const p = spawn("tasklist", ["/FI", "IMAGENAME eq Kayro.exe", "/FO", "CSV", "/NH"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let s = "";
    p.stdout.on("data", (d) => (s += d));
    p.on("close", () => res([...s.matchAll(/"Kayro\.exe","(\d+)"/g)].map((m) => Number(m[1]))));
  });
}
/** Lines of the test instance's log written since `sinceIso` (UTC, as tracing writes them). */
export function logSince(sinceIso) {
  const dir = join(DATA, "logs");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".log"))
    .sort()
    .flatMap((f) => readFileSync(join(dir, f), "utf8").split("\n"))
    .filter((l) => l && l.slice(0, 23) >= sinceIso.slice(0, 23));
}

// ---------- CDP (inputs, evaluation, tracing; never a screenshot) ----------
async function targets() {
  try {
    return await (
      await fetch(`http://127.0.0.1:${CDP_PORT}/json`, { signal: AbortSignal.timeout(1500) })
    ).json();
  } catch {
    return [];
  }
}
export async function connect({ widget = false, timeoutMs = 15000, poll = 25 } = {}) {
  const t0 = now();
  let page;
  while (!page && now() - t0 < timeoutMs) {
    page = (await targets()).find(
      (t) =>
        t.type === "page" && /tauri\.localhost/.test(t.url) && /w=widget/.test(t.url) === widget,
    );
    if (!page) await sleep(poll);
  }
  if (!page) throw new Error("no page target (widget=" + widget + ")");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  // A page destroyed (mode change, widget) answers nothing more: every call still waiting returns.
  ws.onclose = () => {
    for (const res of pending.values()) res({ error: "page closed" });
    pending.clear();
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method) listeners.get(m.method)?.(m.params);
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => {
        if (pending.delete(i)) res({ error: "timeout: " + method });
      }, 15000);
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.error)
      throw new Error("cdp: " + (r.error.message ?? r.error) + " — " + expression.slice(0, 60));
    if (r.result?.exceptionDetails)
      throw new Error(
        "eval: " +
          (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text),
      );
    return r.result?.result?.value;
  };
  const s = {
    send,
    evaluate,
    on: (method, fn) => listeners.set(method, fn),
    close: () => ws.close(),
    move: (x, y) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }),
    /** Sends `points` mouse moves back to back, waiting only for the last one. */
    async moveBurst(points) {
      let last;
      for (const [x, y] of points)
        last = send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await last;
    },
    async click(x, y) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await sleep(30);
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
      await sleep(50);
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
    },
    async key(key, { vk = 0, modifiers = 0 } = {}) {
      await send("Input.dispatchKeyEvent", {
        type: "rawKeyDown",
        key,
        code: key,
        windowsVirtualKeyCode: vk,
        modifiers,
      });
      await send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code: key,
        windowsVirtualKeyCode: vk,
        modifiers,
      });
    },
    box: (sel) =>
      evaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null; })()`,
      ),
    async clickSel(sel) {
      const b = await s.box(sel);
      if (!b) throw new Error("not found: " + sel);
      await s.click(b.x, b.y);
      return b;
    },
    /** Clicks the visible button whose aria-label (or text) is exactly `text`, inside `scope`. */
    async clickText(text, scope = "") {
      const ok = await evaluate(`(() => {
        document.querySelectorAll('[data-bench-t]').forEach(e => e.removeAttribute('data-bench-t'));
        const b = [...document.querySelectorAll(${JSON.stringify((scope ? scope + " " : "") + "button")})]
          .find(b => b.getBoundingClientRect().width > 0 && (b.getAttribute('aria-label') || b.textContent).trim() === ${JSON.stringify(text)});
        if (!b) return false; b.setAttribute('data-bench-t', '1'); return true; })()`);
      if (!ok) throw new Error("button not found: " + text);
      return s.clickSel('[data-bench-t="1"]');
    },
    has: (sel) =>
      evaluate(
        `(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && e.getBoundingClientRect().width > 0; })()`,
      ),
    /** settings_set; never waits more than 3 s (a mode change may destroy the page first). */
    settings: (patch) =>
      Promise.race([
        evaluate(
          `window.__TAURI_INTERNALS__.invoke("settings_set", { patch: ${JSON.stringify(patch)} })`,
        ).catch(() => null),
        sleep(3000),
      ]),
    invoke: (cmd, args = {}) =>
      evaluate(
        `window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`,
      ),
  };
  return s;
}
/** The app document is loaded and React has mounted something. */
export async function ready(s, timeoutMs = 15000) {
  const t0 = now();
  while (now() - t0 < timeoutMs) {
    try {
      if (
        await s.evaluate(
          `document.readyState !== "loading" && (document.getElementById("root")?.childElementCount ?? 0) > 0`,
        )
      )
        return true;
    } catch {
      /* the document is being replaced */
    }
    await sleep(20);
  }
  return false;
}

// ---------- frame probe: interval between frames (rAF), as in every round since 12b ----------
// Options: `opening` notes the opening's wave / background per frame; `opacity` notes the page's
// opacity per frame (passages); pointer moves received are always counted.
const PROBE_JS = (o) => `(() => {
  if (window.__probe) window.__probe.on = false;
  const P = (window.__probe = { t: [], marks: [], ext: [], pm: 0, on: true });
  if (!window.__probePm) { window.__probePm = true; addEventListener('pointermove', () => { if (window.__probe) window.__probe.pm++; }, { capture: true, passive: true }); }
  const f = (ts) => {
    if (!P.on) return;
    P.t.push(ts);
    ${o.opening ? `{ const w = document.querySelector('[data-part="wave"]'); P.ext.push([ts, w ? w.style.opacity : null, !!document.querySelector('[data-part="bg"]')]); }` : ""}
    ${o.opacity ? `P.ext.push([ts, +getComputedStyle(document.body).opacity]);` : ""}
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
  return performance.now();
})()`;
export async function probeStart(s, o = {}) {
  const src = PROBE_JS(o);
  if (o.early) {
    await s.send("Page.enable");
    await s.send("Page.addScriptToEvaluateOnNewDocument", { source: src });
  }
  await ready(s);
  if (!(await s.evaluate("!!(window.__probe && window.__probe.on)"))) await s.evaluate(src);
}
export const mark = (s, label) =>
  s.evaluate(
    `(window.__probe && window.__probe.marks.push([performance.now(), ${JSON.stringify(label)}]), 0)`,
  );
export const probeStop = (s) =>
  s.evaluate(
    `(() => { const P = window.__probe; P.on = false; return { t: P.t, marks: P.marks, ext: P.ext, pm: P.pm, focus: document.hasFocus(), w: innerWidth, h: innerHeight, dpr: devicePixelRatio }; })()`,
  );

// ---------- stats ----------
export const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
export function pct(arr, p) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)];
}
export function frameStats(t) {
  const d = [];
  for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
  return {
    n: d.length,
    p50: r2(pct(d, 0.5)),
    p95: r2(pct(d, 0.95)),
    max: r2(Math.max(...d)),
    over8: d.filter((x) => x > 8).length,
    over16: d.filter((x) => x > 16).length,
  };
}
/** Frames ending inside [mark, mark + dur] for the marks `filter` keeps: p95, > 8 ms, worst occurrence. */
export function duringStats(t, marks, dur, filter = () => true) {
  const ivs = [];
  const per = [];
  for (const [m, label] of marks) {
    if (!filter(label)) continue;
    let c8 = 0;
    let mx = 0;
    for (let i = 1; i < t.length; i++) {
      if (t[i] < m || t[i] > m + dur) continue;
      const d = t[i] - t[i - 1];
      ivs.push(d);
      if (d > 8) c8++;
      mx = Math.max(mx, d);
    }
    per.push({ over8: c8, max: r2(mx) });
  }
  return {
    occ: per.length,
    p95: r2(pct(ivs, 0.95)),
    over8: ivs.filter((x) => x > 8).length,
    over16: ivs.filter((x) => x > 16).length,
    max: r2(ivs.length ? Math.max(...ivs) : null),
    worstOcc: per.reduce((a, b) => Math.max(a, b.over8), 0),
  };
}
