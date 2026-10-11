// Dev server endpoints of the art direction workshop (step 12b, `/dev/atelier`). `apply: "serve"`:
// this code never reaches a build. It writes only under src/design/presets/ and
// src/design/da/active.json, after the same validation as the app (src/design/da/values.ts).
//   GET  /__atelier/presets          saved presets and the dated history
//   POST /__atelier/presets          save a preset (+ a dated copy in presets/history/)
//   POST /__atelier/export           write the preset as the app's art direction (active.json)
//   GET  /__atelier/cost?seconds=N   CPU / GPU of the running app (scripts/measure-cost.ps1)
import { execFile } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { MAX_DA_BYTES, parsePreset } from "../src/design/da/values";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PRESETS = join(ROOT, "src/design/presets");
const HISTORY = join(PRESETS, "history");
const ACTIVE = join(ROOT, "src/design/da/active.json");
const COST_SCRIPT = join(ROOT, "scripts/measure-cost.ps1");

/** File name of a preset: lower-case ASCII, digits and dashes only (no path can come through). */
export function presetSlug(name: string): string | null {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(slug) ? slug : null;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_DA_BYTES) {
        fail(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        ok(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch (e) {
        fail(e);
      }
    });
    req.on("error", fail);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function listDir(dir: string): { file: string; preset: unknown }[] {
  mkdirSync(dir, { recursive: true });
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      try {
        return { file, preset: JSON.parse(readFileSync(join(dir, file), "utf-8")) as unknown };
      } catch {
        return { file, preset: null };
      }
    });
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function measureCost(seconds: number): Promise<unknown> {
  return new Promise((ok) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        COST_SCRIPT,
        "-Seconds",
        String(seconds),
      ],
      { timeout: (seconds + 30) * 1000, windowsHide: true },
      (err, stdout) => {
        if (err) return ok({ error: err.message });
        try {
          ok(JSON.parse(stdout.trim().split(/\r?\n/).pop() ?? "{}"));
        } catch {
          ok({ error: "unreadable output" });
        }
      },
    );
  });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = `${req.method} ${url.pathname}`;
  if (route === "GET /__atelier/presets") {
    return send(res, 200, { presets: listDir(PRESETS), history: listDir(HISTORY) });
  }
  if (route === "GET /__atelier/cost") {
    const s = Math.round(Number(url.searchParams.get("seconds")));
    if (!(s >= 3 && s <= 60)) return send(res, 400, { error: "seconds: 3–60" });
    return send(res, 200, await measureCost(s));
  }
  if (route === "POST /__atelier/presets" || route === "POST /__atelier/export") {
    const parsed = parsePreset(await readBody(req));
    if (!parsed.ok) return send(res, 400, { error: parsed.error });
    const json = `${JSON.stringify(parsed.preset, null, 2)}\n`;
    if (route === "POST /__atelier/export") {
      writeFileSync(ACTIVE, json);
      return send(res, 200, { file: "src/design/da/active.json" });
    }
    const slug = presetSlug(parsed.preset.name);
    if (!slug) return send(res, 400, { error: "Nom de préréglage invalide." });
    mkdirSync(HISTORY, { recursive: true });
    writeFileSync(join(PRESETS, `${slug}.json`), json);
    writeFileSync(join(HISTORY, `${stamp()}-${slug}.json`), json);
    return send(res, 200, { file: `src/design/presets/${slug}.json` });
  }
  send(res, 404, { error: "not found" });
}

export function atelier(): Plugin {
  return {
    name: "kayro-atelier",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__atelier/")) return next();
        handle(req, res).catch((e: unknown) => send(res, 500, { error: String(e) }));
      });
    },
  };
}
